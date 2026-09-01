import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./RecordPayment.css";
import html2pdf from "html2pdf.js";
import { request } from "../../services/apiClient";
import { saveBranchPaymentHistoryEntry } from "../../lib/branchPaymentHistoryStore";
import { loadBranchStudents } from "../../lib/branchStudentStore";

const escapeReceiptValue = (value) => String(value ?? "-")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#039;");

const getReceiptInstallmentNumber = (paymentFor) => {
  const match = String(paymentFor || "").match(/installment\s+(\d+)/i);
  return match ? Number(match[1]) : null;
};

const getReceiptInstallmentAmount = (installment) => Number(
  installment?.amount ?? installment?.totalAmount ?? 0
);

const getReceiptPaidAmount = (installment) => Number(
  installment?.paidAmount ?? installment?.amountPaid ?? 0
);

const applyReceiptPaymentToSchedule = (
  schedule,
  paymentFor,
  currentPayment,
  paymentAlreadyApplied = false
) => {
  const source = Array.isArray(schedule) ? schedule : [];
  const payment = Math.max(Number(currentPayment) || 0, 0);
  if (paymentAlreadyApplied || !payment || !source.length) {
    return source.map((installment, index) => ({
      ...installment,
      installmentNumber: Number(installment?.installmentNumber || index + 1),
    }));
  }

  const targetNumber = getReceiptInstallmentNumber(paymentFor);
  const result = source.map((installment, index) => ({
    ...installment,
    installmentNumber: Number(installment?.installmentNumber || index + 1),
  }));

  if (targetNumber) {
    const target = result.find((installment) => installment.installmentNumber === targetNumber);
    if (!target) {
      return result;
    }

    const amount = getReceiptInstallmentAmount(target);
    const paid = getReceiptPaidAmount(target);
    if (amount > paid) {
      target.paidAmount = Math.min(amount, paid + payment);
    }
    return result;
  }

  if (/full\s*payment/i.test(String(paymentFor || ""))) {
    let remaining = payment;
    for (const installment of result) {
      const amount = getReceiptInstallmentAmount(installment);
      const paid = getReceiptPaidAmount(installment);
      const outstanding = Math.max(amount - paid, 0);
      if (!outstanding || remaining <= 0) {
        continue;
      }
      const applied = Math.min(outstanding, remaining);
      installment.paidAmount = paid + applied;
      remaining -= applied;
    }
  }

  return result;
};

const buildModernPaymentReceiptHtml = ({
  logoUrl,
  instituteName,
  branchName,
  branchAddress,
  branchPhone,
  branchEmail,
  studentName,
  admissionId,
  courseName,
  batchName,
  studentPhone,
  receiptNumber,
  receiptDate,
  paymentDate,
  paymentFor,
  paymentMode,
  transactionReference,
  collectedBy,
  notes,
  totalCourseFee,
  previouslyPaid,
  currentPayment,
  totalPaid,
  balance,
  amountInWords,
  installments,
  paymentAlreadyApplied = false,
}) => {
  const safe = escapeReceiptValue;
  const money = (value) => `&#8377;${Number(value || 0).toLocaleString("en-IN")}`;
  const displayInstallments = applyReceiptPaymentToSchedule(
    installments,
    paymentFor,
    currentPayment,
    paymentAlreadyApplied
  );
  const installmentRows = displayInstallments.map((item, index) => {
    const amount = getReceiptInstallmentAmount(item);
    const paid = getReceiptPaidAmount(item);
    const isPaid = amount > 0 && paid >= amount;
    const isPartial = paid > 0 && paid < amount;
    const dueDate = item?.dueDate || item?.date || "-";
    return `<tr>
      <td>Installment ${safe(item?.installmentNumber || index + 1)}</td>
      <td>${safe(dueDate)}</td>
      <td>${money(amount)}</td>
      <td><span class="status ${isPaid ? "paid" : isPartial ? "partial" : "pending"}">${isPaid ? "PAID" : isPartial ? "PARTIAL" : "PENDING"}</span></td>
    </tr>`;
  }).join("");

  const pending = displayInstallments.find((item) => {
    const amount = getReceiptInstallmentAmount(item);
    const paid = getReceiptPaidAmount(item);
    return amount > paid;
  });
  const nextPayment = pending ? `<section class="next-payment">
    <div class="section-title">NEXT PAYMENT DETAILS</div>
    <div class="next-grid">
      <span>Next Installment</span><strong>Installment ${safe(pending.installmentNumber || "-")}</strong>
      <span>Due Date</span><strong>${safe(pending.dueDate || pending.date || "-")}</strong>
      <span>Amount Due</span><strong class="next-amount">${money(Math.max(Number(pending.amount || pending.totalAmount || 0) - Number(pending.paidAmount ?? pending.amountPaid ?? 0), 0))}</strong>
    </div>
  </section>` : "";

  const detailRow = (label, value) => `<div class="detail-row"><span>${safe(label)}</span><strong>${String(value || "-").startsWith("&#8377;") ? value : safe(value || "-")}</strong></div>`;

  return `<style>
    *{box-sizing:border-box} .receipt-page{width:794px;min-height:1123px;padding:22px 28px 0;background:#fff;color:#132044;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3}
    .receipt-header{display:flex;justify-content:space-between;gap:18px;padding-bottom:12px;border-bottom:1px solid #cbd5e1}.brand-block{display:flex;align-items:flex-start;gap:10px;max-width:49%}.brand-logo{width:112px;height:52px;object-fit:contain}.institute-name{font-size:15px;font-weight:800;color:#102b67;text-transform:uppercase;letter-spacing:.2px}.branch-line{margin-top:4px;font-weight:700}.address{margin-top:3px;line-height:1.3;color:#475569}.contact{margin-top:4px;color:#475569}.title-block{text-align:right;min-width:270px}.receipt-title{font-family:"Arial Narrow","Roboto Condensed",Arial,Helvetica,sans-serif;font-size:27px;line-height:1;font-weight:900;letter-spacing:1.5px;color:#102b67;margin:5px 0 10px;white-space:nowrap}.thank-you{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border:1px solid #36a269;border-radius:8px;background:#f0faf4;color:#16834a;font-weight:800;white-space:nowrap}
    .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:12px 0;padding:9px 10px;border:1px solid #9fb1d2;border-radius:9px}.meta-grid .detail-row{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:4px 10px;border-right:1px dashed #b7c3d8;min-height:42px}.meta-grid .detail-row:nth-child(3n){border-right:0}.meta-grid .detail-row:nth-child(n+4){border-top:1px solid #edf1f7;padding-top:7px}.meta-grid .detail-row span{display:block;text-transform:uppercase;font-size:8px;letter-spacing:.5px}.meta-grid .detail-row strong{display:block;margin-top:3px;font-size:11px;line-height:1.15;overflow-wrap:anywhere}
    .two-column{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;align-items:start}.card{border:1px solid #bdcbe1;border-radius:8px;overflow:hidden;background:#fff;page-break-inside:avoid}.section-title{font-family:"Arial Narrow","Roboto Condensed",Arial,Helvetica,sans-serif;padding:6px 10px;background:#102b67;color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.8px;line-height:1.15}.detail-row{display:flex;justify-content:space-between;gap:10px;padding:5px 10px;border-bottom:1px solid #edf1f7;min-height:23px}.detail-row span{color:#475569}.detail-row strong{text-align:right;color:#132044;font-weight:700;overflow-wrap:anywhere}.detail-row.green strong{color:#16834a}.table-head{display:flex;justify-content:space-between;padding:5px 10px;background:#f1f5fa;color:#102b67;font-size:9px;font-weight:800;letter-spacing:.35px}.total-row{display:flex;justify-content:space-between;padding:7px 10px;border-top:1px dashed #98a9c5;font-size:12px;font-weight:800}.balance strong{color:#dc3b3b}.amount-box{position:relative;margin:10px 0;padding:10px;text-align:center;border:1px dashed #47ae76;border-radius:9px;background:#f4fbf6;page-break-inside:avoid}.amount-label{font-family:"Arial Narrow","Roboto Condensed",Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:.7px;color:#16834a}.amount{margin:1px 0;font-size:27px;font-weight:900;letter-spacing:.3px;color:#159447}.words{font-size:10px;color:#475569}.received{position:absolute;right:18px;top:19px;padding:6px 8px;border:2px solid #25a35b;border-radius:50%;color:#16834a;font-size:9px;font-weight:900;transform:rotate(-12deg)}
    table{width:100%;border-collapse:collapse;font-size:9px}th,td{padding:5px 6px;border-bottom:1px solid #e3eaf3;text-align:left}th{background:#f1f5fa;color:#102b67;font-size:8px;letter-spacing:.35px}th:nth-child(n+3),td:nth-child(n+3){text-align:right}.status{display:inline-flex;align-items:center;justify-content:center;padding:2px 6px;border:1px solid;border-radius:10px;font-size:8px;font-weight:800;letter-spacing:.2px;white-space:nowrap}.status.paid{border-color:#54bc7f;color:#16834a;background:#f1fbf4}.status.partial{border-color:#e3a52e;color:#a26000;background:#fff8e7}.status.pending{border-color:#f1a33d;color:#b96900;background:#fff8ec}.empty{text-align:center!important;color:#64748b}.next-payment{margin:6px 6px 6px;border:1px solid #9dbcf0;border-radius:6px;background:#f4f8ff;page-break-inside:avoid}.next-payment .section-title{padding:5px 8px;background:transparent;color:#164a9c;border-bottom:1px solid #cdddf7}.next-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:6px 8px}.next-grid strong{text-align:right}.next-amount{color:#16834a}.payment-status{display:grid;grid-template-columns:1.3fr auto 2fr;align-items:center;gap:10px;margin-top:10px;padding:8px 10px;border:1px solid #f3b65b;border-radius:7px;background:#fff9ef;color:#743f0b;page-break-inside:avoid}.payment-status>strong{font-family:"Arial Narrow","Roboto Condensed",Arial,Helvetica,sans-serif;color:#9d5500;letter-spacing:.6px}.payment-status>span:last-child{text-align:left;color:#7b5b36}.receipt-footer{display:flex;justify-content:space-between;gap:10px;margin:14px -28px 0;padding:8px 28px;background:#102b67;color:#fff;font-size:8px;line-height:1.2}
    @media print{.receipt-page{min-height:0;margin:0}.card,.meta-grid,.amount-box,.payment-status,.next-payment{page-break-inside:avoid}}
  </style><div class="receipt-page">
    <header class="receipt-header">
      <div class="brand-block">
        <img class="brand-logo" src="${safe(logoUrl)}" alt="CISPRO logo" />
        <div><div class="institute-name">${safe(instituteName)}</div>
          <div class="branch-line">Branch: ${safe(branchName)}</div>
          <div class="address">${safe(branchAddress)}</div>
          <div class="contact">${safe(branchPhone)} ${branchEmail ? `&nbsp;&nbsp;|&nbsp;&nbsp;${safe(branchEmail)}` : ""}</div>
        </div>
      </div>
      <div class="title-block"><div class="receipt-title">PAYMENT RECEIPT</div><div class="thank-you">&#10003;&nbsp; THANK YOU FOR YOUR PAYMENT!</div></div>
    </header>

    <section class="meta-grid">
      ${detailRow("Receipt No", receiptNumber)}${detailRow("Receipt Date", receiptDate)}${detailRow("Branch", branchName)}
      ${detailRow("Student ID", admissionId)}${detailRow("Payment Date", paymentDate)}${detailRow("Payment Type", paymentFor || "Payment")}
    </section>

    <div class="two-column">
      <section class="card"><div class="section-title">STUDENT DETAILS</div>${detailRow("Student Name", studentName)}${detailRow("Admission ID", admissionId)}${detailRow("Course", courseName)}${detailRow("Batch", batchName)}${detailRow("Contact Number", studentPhone)}</section>
      <section class="card"><div class="section-title">PAYMENT DETAILS</div>${detailRow("Payment For", paymentFor)}${detailRow("Payment Mode", paymentMode)}${detailRow("Transaction Ref", transactionReference)}${detailRow("Collected By", collectedBy)}${detailRow("Remarks", notes)}</section>
    </div>

    <section class="amount-box"><div class="amount-label">AMOUNT RECEIVED</div><div class="amount">${money(currentPayment)}</div><div class="words">${safe(amountInWords)}</div><span class="received">RECEIVED</span></section>

    <div class="two-column summary-columns">
      <section class="card fee-card"><div class="section-title">FEE SUMMARY</div><div class="table-head"><span>DESCRIPTION</span><span>AMOUNT</span></div>${detailRow("Total Course Fee", money(totalCourseFee))}${detailRow("Previously Paid", money(previouslyPaid))}<div class="detail-row green"><span>Current Payment</span><strong>${money(currentPayment)}</strong></div><div class="total-row"><span>Total Paid</span><strong>${money(totalPaid)}</strong></div><div class="detail-row balance"><span>Remaining Balance</span><strong>${money(balance)}</strong></div></section>
      <section class="card installment-card"><div class="section-title">INSTALLMENT DETAILS</div><table><thead><tr><th>INSTALLMENT</th><th>DUE DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>${installmentRows || `<tr><td colspan="4" class="empty">No installment schedule available</td></tr>`}</tbody></table>${nextPayment}</section>
    </div>

    <section class="payment-status"><strong>PAYMENT STATUS</strong><span class="status ${balance > 0 ? "pending" : "paid"}">${balance > 0 ? "PARTIALLY PAID" : "PAID"}</span><span>Thank you! Your payment has been recorded successfully.</span></section>
    <footer class="receipt-footer"><span>This is a computer-generated receipt and does not require a physical signature.</span><span>Generated on: ${safe(new Date().toLocaleString("en-IN"))}</span></footer>
  </div>`;
};

const getStudentSearchText = (studentRecord) => {
  const studentId = String(studentRecord?.studentId || "").trim();
  const studentName = String(
    studentRecord?.studentName || studentRecord?.name || ""
  ).trim();

  return `${studentId} ${studentName}`.trim().toLowerCase();
};

const getStudentSearchTokens = (studentRecord) => {
  const studentId = String(studentRecord?.studentId || "").trim().toLowerCase();
  const studentName = String(
    studentRecord?.studentName || studentRecord?.name || ""
  )
    .trim()
    .toLowerCase();

  return [studentId, studentName].filter(Boolean);
};

const formatStudentSuggestionLabel = (studentRecord) => {
  const studentId = String(studentRecord?.studentId || "").trim();
  const studentName = String(
    studentRecord?.studentName || studentRecord?.name || "Unnamed Student"
  ).trim();

  if (studentId && studentName) {
    return `${studentName} (${studentId})`;
  }

  return studentName || studentId || "Student";
};

const getPendingInstallmentDefaults = (studentRecord) => {
  const installmentSchedule = Array.isArray(studentRecord?.installmentSchedule)
    ? studentRecord.installmentSchedule
    : [];

  const pendingInstallment = installmentSchedule.find((installment) => {
    const status = String(installment?.status || "").toLowerCase();
    return status !== "paid";
  });

  if (!pendingInstallment) {
    return null;
  }

  const amount = Number(pendingInstallment?.amount || 0);
  const amountPaid = Number(
    pendingInstallment?.amountPaid ?? pendingInstallment?.paidAmount ?? 0
  );
  const pendingAmount = Math.max(amount - amountPaid, 0);

  return {
    payAgainst: `Installment ${pendingInstallment.installmentNumber}`,
    amountToPay: String(pendingAmount),
    amountReceived: String(pendingAmount),
  };
};

const EMPTY_STUDENT = {};

const RecordPayment = ({ student, students = [], onClose, branchProfile = null }) => {
  const initialStudent = student?.studentId ? student : null;

  // =========================================================
  // FORM DATA
  // =========================================================

  const [formData, setFormData] = useState(() => ({
    payAgainst: "",
    amountToPay: "",
    amountReceived: "",
    paymentMode: "",
    transactionReference: "",
    paymentDate: new Date().toISOString().split("T")[0],
    collectedBy: "",
    branch: "",
    notes: "",
    paymentProof: null,
    ...(getPendingInstallmentDefaults(initialStudent || null) || {}),
  }));

  // =========================================================
  // STATE
  // =========================================================

  const [errors, setErrors] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const [receiptNumber, setReceiptNumber] = useState("");

  const [paymentSaved, setPaymentSaved] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const [studentIdInput, setStudentIdInput] = useState(
    initialStudent?.studentId || ""
  );

  const [selectedStudent, setSelectedStudent] = useState(initialStudent);

  const [isLoadingStudent, setIsLoadingStudent] = useState(false);
  const [studentLookupError, setStudentLookupError] = useState("");
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [showStudentSuggestions, setShowStudentSuggestions] =
    useState(false);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const studentSearchRequestIdRef = useRef(0);
  const currentBranchScope = useMemo(
    () => initialStudent?.branchId || initialStudent?.branchCode || initialStudent?.branchKey || "",
    [initialStudent]
  );

  // =========================================================
  // ACTIVE STUDENT
  // =========================================================

  const activeStudent = useMemo(
    () => selectedStudent || initialStudent || EMPTY_STUDENT,
    [selectedStudent, initialStudent]
  );

  // =========================================================
  // STUDENT DATA
  // =========================================================

  const studentName =
    activeStudent?.studentName ||
    activeStudent?.name ||
    "Student Name";

  const admissionId =
    activeStudent?.admissionId ||
    activeStudent?.admissionID ||
    activeStudent?.studentId ||
    "ADM-2026-001";

  const courseName =
    activeStudent?.courseName ||
    activeStudent?.course ||
    activeStudent?.selectedCourse ||
    "Data Analytics";

  const branchName =
    branchProfile?.branchName ||
    activeStudent?.branchName ||
    formData.branch ||
    "Cispro Training";

  const branchAddress =
    branchProfile?.branchAddress ||
    activeStudent?.branchAddress ||
    "-";

  const branchPhone =
    branchProfile?.branchPhone ||
    activeStudent?.branchPhone ||
    "";

  const branchEmail =
    branchProfile?.branchEmail ||
    activeStudent?.branchEmail ||
    "";

  const batchName =
    activeStudent?.batchName ||
    activeStudent?.batch ||
    "-";

  const studentPhone =
    activeStudent?.mobileNumber ||
    activeStudent?.phone ||
    "-";

  // =========================================================
  // FEE DATA
  // =========================================================

  const totalCourseFee = Number(
    activeStudent?.totalCourseFee ||
      activeStudent?.courseFee ||
      activeStudent?.totalFees ||
      activeStudent?.totalAmount ||
      activeStudent?.courseAmount ||
      activeStudent?.afterDiscount ||
      0
  );

  const installments = Array.isArray(
    activeStudent?.installmentSchedule
  )
    ? activeStudent.installmentSchedule
    : [];

  const previouslyPaid = installments.length
    ? installments.reduce((sum, installment) => {
        return (
          sum +
          Number(
            installment?.paidAmount ??
              installment?.amountPaid ??
              0
          )
        );
      }, 0)
    : Number(
        activeStudent?.previouslyPaid ||
          activeStudent?.paidAmount ||
          activeStudent?.totalPaid ||
          0
      );

  const currentPayment = Number(
    formData.amountReceived || 0
  );

  const totalPaid = previouslyPaid + currentPayment;

  const balance = Math.max(
    totalCourseFee - totalPaid,
    0
  );

  // =========================================================
  // CURRENT INSTALLMENT BALANCE
  // =========================================================

  const currentInstallmentAmount = Number(
    formData.amountToPay || 0
  );

  const installmentBalance = Math.max(
    currentInstallmentAmount - currentPayment,
    0
  );

  const selectStudent = useCallback((studentRecord) => {
    if (!studentRecord?.studentId) {
      return;
    }

    setSelectedStudent(studentRecord);
    setStudentIdInput(String(studentRecord.studentId || "").trim());
    setStudentLookupError("");
    setStudentSearchResults([]);
    setShowStudentSuggestions(false);
    setErrors({});
    const installmentDefaults = getPendingInstallmentDefaults(studentRecord);
    if (installmentDefaults) {
      setFormData((previous) => ({
        ...previous,
        ...installmentDefaults,
      }));
    }
  }, []);

  const searchStudents = useCallback(async (searchTerm) => {
    const query = String(searchTerm || "").trim();

    if (!query) {
      setStudentSearchResults([]);
      setShowStudentSuggestions(false);
      return [];
    }

    const requestId = studentSearchRequestIdRef.current + 1;
    studentSearchRequestIdRef.current = requestId;

    setIsSearchingStudents(true);

    try {
      const normalizedQuery = query.toLowerCase();
      const localStudents =
        Array.isArray(students) && students.length > 0
          ? students
          : loadBranchStudents(currentBranchScope);

      const matches = localStudents.filter((record) => {
        const haystack = getStudentSearchText(record);
        const tokens = getStudentSearchTokens(record);

        return (
          haystack.includes(normalizedQuery) ||
          tokens.some((token) => token.startsWith(normalizedQuery))
        );
      });

      if (studentSearchRequestIdRef.current !== requestId) {
        return matches;
      }

      setStudentSearchResults(matches.slice(0, 10));
      setShowStudentSuggestions(true);

      return matches;
    } catch (error) {
      console.error("Student search failed:", error);

      if (studentSearchRequestIdRef.current === requestId) {
        setStudentSearchResults([]);
        setShowStudentSuggestions(false);
      }

      return [];
    } finally {
      if (studentSearchRequestIdRef.current === requestId) {
        setIsSearchingStudents(false);
      }
    }
  }, [currentBranchScope, students]);

  useEffect(() => {
    if (selectedStudent) {
      return;
    }

    const query = studentIdInput.trim();

    if (!query) {
      return;
    }

    const debounceId = window.setTimeout(() => {
      searchStudents(query);
    }, 250);

    return () => window.clearTimeout(debounceId);
  }, [studentIdInput, selectedStudent, searchStudents]);

  // =========================================================
  // STUDENT LOOKUP
  // =========================================================

  const handleStudentLookup = async () => {
    const enteredStudentQuery = studentIdInput.trim();

    if (!enteredStudentQuery) {
      setStudentLookupError(
        "Please enter Student ID or Student Name."
      );
      return;
    }

    setIsLoadingStudent(true);
    setStudentLookupError("");

    try {
      const matches = await searchStudents(enteredStudentQuery);

      if (!matches.length) {
        setStudentLookupError(
          `No student found matching "${enteredStudentQuery}".`
        );
        setSelectedStudent(null);
        setShowStudentSuggestions(false);
        return;
      }

      const normalizedQuery = enteredStudentQuery.toLowerCase();
      const exactMatch = matches.find((item) => {
        const studentId = String(item?.studentId || "").trim().toLowerCase();
        const studentName = String(
          item?.studentName || item?.name || ""
        )
          .trim()
          .toLowerCase();

        return (
          studentId === normalizedQuery ||
          studentName === normalizedQuery
        );
      });

      if (exactMatch) {
        selectStudent(exactMatch);
        return;
      }

      if (matches.length === 1) {
        selectStudent(matches[0]);
        return;
      }

      setStudentSearchResults(matches.slice(0, 10));
      setShowStudentSuggestions(true);
      setStudentLookupError(
        `Multiple students found for "${enteredStudentQuery}". Please choose one from the list.`
      );
    } catch (error) {
      console.error(
        "Student lookup failed:",
        error
      );

      setStudentLookupError(
        "Unable to load student details. Please try again."
      );
    } finally {
      setIsLoadingStudent(false);
    }
  };

  // =========================================================
  // FORMAT CURRENCY
  // =========================================================

  const formatCurrency = (amount) => {
    return Number(amount || 0).toLocaleString(
      "en-IN"
    );
  };

  // =========================================================
  // NUMBER TO WORDS
  // =========================================================

  const numberToWords = (value) => {
    let number = Number(value);

    if (!number || number === 0) {
      return "Zero Rupees Only";
    }

    number = Math.floor(number);

    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];

    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    const convertBelowThousand = (num) => {
      let result = "";

      if (num >= 100) {
        result +=
          ones[Math.floor(num / 100)] +
          " Hundred ";

        num %= 100;
      }

      if (num >= 20) {
        result +=
          tens[Math.floor(num / 10)] + " ";

        num %= 10;
      }

      if (num > 0) {
        result += ones[num] + " ";
      }

      return result.trim();
    };

    let result = "";

    const crore = Math.floor(
      number / 10000000
    );

    number %= 10000000;

    const lakh = Math.floor(
      number / 100000
    );

    number %= 100000;

    const thousand = Math.floor(
      number / 1000
    );

    number %= 1000;

    if (crore > 0) {
      result +=
        convertBelowThousand(crore) +
        " Crore ";
    }

    if (lakh > 0) {
      result +=
        convertBelowThousand(lakh) +
        " Lakh ";
    }

    if (thousand > 0) {
      result +=
        convertBelowThousand(thousand) +
        " Thousand ";
    }

    if (number > 0) {
      result +=
        convertBelowThousand(number);
    }

    return `Rupees ${result.trim()} Only`;
  };

  const formatDateDMY = (dateString) => {
    if (!dateString) {
      return "-";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  // =========================================================
  // HANDLE INPUT CHANGE
  // =========================================================

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    if (
      name === "amountToPay" ||
      name === "amountReceived"
    ) {
      if (!/^\d*\.?\d*$/.test(value)) {
        return;
      }
    }

    setFormData((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "paymentMode" && value === "Cash"
        ? { transactionReference: "" }
        : {}),
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  };

  // =========================================================
  // FILE CHANGE
  // =========================================================

  const handleFileChange = (event) => {
    const file =
      event.target.files?.[0] || null;

    setFormData((previous) => ({
      ...previous,
      paymentProof: file,
    }));
  };

  // =========================================================
  // FORM VALIDATION
  // =========================================================

  const validateForm = () => {
    const newErrors = {};

    if (!activeStudent?.id) {
      newErrors.student =
        "Please select a valid student.";
    }

    if (!formData.payAgainst.trim()) {
      newErrors.payAgainst =
        "This field is required.";
    }

    if (!formData.amountToPay.trim()) {
      newErrors.amountToPay =
        "This field is required.";
    } else if (
      Number(formData.amountToPay) <= 0
    ) {
      newErrors.amountToPay =
        "Amount must be greater than 0.";
    }

    if (!formData.amountReceived.trim()) {
      newErrors.amountReceived =
        "This field is required.";
    } else if (
      Number(formData.amountReceived) <= 0
    ) {
      newErrors.amountReceived =
        "Amount must be greater than 0.";
    }

    if (
      Number(formData.amountReceived) >
      Number(formData.amountToPay)
    ) {
      newErrors.amountReceived =
        "Amount received cannot be greater than amount to pay.";
    }

    if (!formData.paymentMode.trim()) {
      newErrors.paymentMode =
        "This field is required.";
    }

    if (!formData.paymentDate.trim()) {
      newErrors.paymentDate =
        "This field is required.";
    }

    if (!formData.collectedBy.trim()) {
      newErrors.collectedBy =
        "This field is required.";
    }

    if (!formData.branch.trim()) {
      newErrors.branch =
        "This field is required.";
    }

    setErrors(newErrors);

    return (
      Object.keys(newErrors).length === 0
    );
  };

  // =========================================================
  // SUBMIT FORM
  // =========================================================

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setShowConfirmation(true);
  };

  // =========================================================
  // CONFIRM PAYMENT
  // =========================================================

  const handleConfirmPayment = () => {
    const temporaryReceiptNumber =
      `REC-${new Date().getFullYear()}-${String(
        Date.now()
      ).slice(-6)}`;

    setReceiptNumber(
      temporaryReceiptNumber
    );

    setPaymentSaved(false);

    setShowConfirmation(false);

    setShowReceipt(true);
  };

  // =========================================================
  // SAVE PAYMENT TO BACKEND
  // =========================================================

  const savePaymentToBackend = async (receiptAttachment = null) => {
    if (paymentSaved) {
      return true;
    }

    if (!activeStudent?.id) {
      alert(
        "Student information is missing. Payment cannot be saved."
      );

      return false;
    }

    setIsSavingPayment(true);

    try {
      const response = await request(
        `/branch-students/${activeStudent.id}/payments`,
        {
          method: "POST",

          body: JSON.stringify({
            amountReceived:
              Number(
                formData.amountReceived
              ),

            paymentMode:
              formData.paymentMode,

            transactionReference:
              formData.transactionReference,

            paymentDate:
              formData.paymentDate,

            collectedBy:
              formData.collectedBy,

            branch:
              formData.branch,

            notes:
              formData.notes,

            payAgainst:
              formData.payAgainst,

            receiptAttachment,
          }),
        }
      );

      const savedReceiptNumber =
        response?.data?.receiptNumber ||
        response?.receiptNumber ||
        receiptNumber;

      saveBranchPaymentHistoryEntry({
        id: savedReceiptNumber,
        receiptNumber: savedReceiptNumber,
        studentId: activeStudent?.studentId || activeStudent?.id || "",
        studentName,
        course: courseName,
        amount: Number(formData.amountReceived),
        paymentMode: formData.paymentMode,
        mode: formData.paymentMode,
        payAgainst: formData.payAgainst,
        paymentDate: formData.paymentDate,
        dateRaw: formData.paymentDate,
        date: formData.paymentDate,
        branchId: activeStudent?.branchId || student?.branchId || "",
        branchCode: activeStudent?.branchCode || student?.branchCode || "",
        collectedBy: formData.collectedBy,
        notes: formData.notes,
        transactionReference: formData.transactionReference,
      });

      setReceiptNumber(
        savedReceiptNumber
      );

      setPaymentSaved(true);

      console.log(
        "Payment saved successfully:",
        {
          student: activeStudent,
          ...formData,
          receiptNumber:
            savedReceiptNumber,
        }
      );

      return true;
    } catch (error) {
      console.error(
        "Failed to save payment:",
        error
      );

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to save payment. Please try again."
      );

      return false;
    } finally {
      setIsSavingPayment(false);
    }
  };

  // =========================================================
  // GENERATE RECEIPT
  // =========================================================

  const handleGenerateReceipt = () => {
    if (isSavingPayment || isGeneratingReceipt) {
      return;
    }

    setIsGeneratingReceipt(true);

    const receiptDate =
      formatDateDMY(formData.paymentDate);

    const amountInWords =
      numberToWords(currentPayment);

    const instituteName =
      activeStudent?.instituteName ||
      "Cispro Training and Placement Pvt Ltd";

    const instituteLocation =
      activeStudent?.instituteLocation ||
      formData.branch ||
      "Chennai";

    const institutePhone =
      activeStudent?.institutePhone ||
      "+91 XXXXX XXXXX";

    const receiptElement =
      document.createElement("div");

    receiptElement.innerHTML = `
      <div
        style="
          width: 800px;
          background: #ffffff;
          padding: 38px;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          box-sizing: border-box;
        "
      >

        <!-- HEADER -->

        <div
          style="
            text-align: center;
            margin-bottom: 28px;
          "
        >

          <h1
            style="
              margin: 0;
              font-size: 25px;
              font-weight: 700;
              color: #111827;
            "
          >
            ${instituteName}
          </h1>

          <div
            style="
              margin-top: 7px;
              font-size: 13px;
              color: #64748b;
            "
          >
            ${instituteLocation} • ${institutePhone}
          </div>

          <div
            style="
              margin-top: 24px;
              font-size: 21px;
              font-weight: 700;
              letter-spacing: 0.5px;
              color: #0f766e;
            "
          >
            PAYMENT RECEIPT
          </div>

        </div>

        <!-- META -->

        <div
          style="
            display: flex;
            justify-content: space-between;
            padding: 16px 0;
            border-top: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 26px;
            font-size: 13px;
          "
        >

          <div>
            Receipt No:
            <strong>
              ${receiptNumber}
            </strong>
          </div>

          <div>
            Date:
            <strong>
              ${receiptDate}
            </strong>
          </div>

        </div>

        <!-- STUDENT DETAILS -->

        <div style="margin-bottom: 25px;">

          <h3
            style="
              margin: 0 0 13px;
              font-size: 13px;
              font-weight: 700;
              color: #334155;
            "
          >
            STUDENT DETAILS
          </h3>

          <div style="
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 20px;
            padding: 8px 0;
            font-size: 13px;
          ">
            <span style="color:#64748b;">
              Student Name
            </span>

            <strong>
              ${studentName}
            </strong>
          </div>

          <div style="
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 20px;
            padding: 8px 0;
            font-size: 13px;
          ">
            <span style="color:#64748b;">
              Admission ID
            </span>

            <strong>
              ${admissionId}
            </strong>
          </div>

          <div style="
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 20px;
            padding: 8px 0;
            font-size: 13px;
          ">
            <span style="color:#64748b;">
              Course
            </span>

            <strong>
              ${courseName}
            </strong>
          </div>

          <div style="
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 20px;
            padding: 8px 0;
            font-size: 13px;
          ">
            <span style="color:#64748b;">
              Branch
            </span>

            <strong>
              ${formData.branch}
            </strong>
          </div>

        </div>

        <div style="
          border-top: 1px solid #e5e7eb;
          margin: 25px 0;
        "></div>

        <!-- PAYMENT DETAILS -->

        <div style="margin-bottom: 25px;">

          <h3
            style="
              margin: 0 0 13px;
              font-size: 13px;
              font-weight: 700;
              color: #334155;
            "
          >
            PAYMENT DETAILS
          </h3>

          <div style="
            display:grid;
            grid-template-columns:180px 1fr;
            gap:20px;
            padding:8px 0;
            font-size:13px;
          ">
            <span style="color:#64748b;">
              Payment For
            </span>

            <strong>
              ${formData.payAgainst}
            </strong>
          </div>

          <div style="
            display:grid;
            grid-template-columns:180px 1fr;
            gap:20px;
            padding:8px 0;
            font-size:13px;
          ">
            <span style="color:#64748b;">
              Payment Mode
            </span>

            <strong>
              ${formData.paymentMode}
            </strong>
          </div>

          <div style="
            display:grid;
            grid-template-columns:180px 1fr;
            gap:20px;
            padding:8px 0;
            font-size:13px;
          ">
            <span style="color:#64748b;">
              Transaction Ref
            </span>

            <strong>
              ${
                formData.transactionReference ||
                "-"
              }
            </strong>
          </div>

          <div style="
            display:grid;
            grid-template-columns:180px 1fr;
            gap:20px;
            padding:8px 0;
            font-size:13px;
          ">
            <span style="color:#64748b;">
              Collected By
            </span>

            <strong>
              ${formData.collectedBy}
            </strong>
          </div>

        </div>

        <div style="
          border-top:1px solid #e5e7eb;
          margin:25px 0;
        "></div>

        <!-- AMOUNT -->

        <div style="padding:18px 0;">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
          ">

            <div style="
              font-size:14px;
              font-weight:600;
              color:#475569;
            ">
              Amount Received
            </div>

            <div style="
              font-size:24px;
              font-weight:700;
              color:#0f766e;
            ">
              ₹${formatCurrency(currentPayment)}
            </div>

          </div>

          <div style="margin-top:12px;">

            <div style="
              font-size:12px;
              color:#64748b;
              margin-bottom:5px;
            ">
              Amount in Words
            </div>

            <div style="
              font-size:13px;
              font-weight:600;
              color:#334155;
            ">
              ${amountInWords}
            </div>

          </div>

        </div>

        <div style="
          border-top:1px solid #e5e7eb;
          margin:25px 0;
        "></div>

        <!-- FEE SUMMARY -->

        <div>

          <h3
            style="
              margin:0 0 13px;
              font-size:13px;
              font-weight:700;
              color:#334155;
            "
          >
            FEE SUMMARY
          </h3>

          <div style="
            display:flex;
            justify-content:space-between;
            padding:9px 0;
            font-size:13px;
          ">
            <span style="color:#64748b;">
              Total Course Fee
            </span>

            <strong>
              ₹${formatCurrency(totalCourseFee)}
            </strong>
          </div>

          <div style="
            display:flex;
            justify-content:space-between;
            padding:9px 0;
            font-size:13px;
          ">
            <span style="color:#64748b;">
              Previously Paid
            </span>

            <strong>
              ₹${formatCurrency(previouslyPaid)}
            </strong>
          </div>

          <div style="
            display:flex;
            justify-content:space-between;
            padding:9px 0;
            font-size:13px;
          ">
            <span style="color:#64748b;">
              This Payment
            </span>

            <strong>
              ₹${formatCurrency(currentPayment)}
            </strong>
          </div>

          ${
            installmentBalance > 0
              ? `
                <div style="
                  display:flex;
                  justify-content:space-between;
                  padding:9px 0;
                  font-size:13px;
                  color:#dc2626;
                ">
                  <span>
                    Installment Balance
                  </span>

                  <strong style="color:#dc2626;">
                    ₹${formatCurrency(
                      installmentBalance
                    )}
                  </strong>
                </div>
              `
              : ""
          }

          <div style="
            display:flex;
            justify-content:space-between;
            border-top:1px solid #cbd5e1;
            margin-top:5px;
            padding-top:13px;
            font-size:13px;
          ">
            <strong>
              Total Paid
            </strong>

            <strong>
              ₹${formatCurrency(totalPaid)}
            </strong>
          </div>

          <div style="
            display:flex;
            justify-content:space-between;
            padding-top:12px;
            font-size:13px;
          ">
            <strong>
              Balance
            </strong>

            <strong
              style="
                color:${
                  balance > 0
                    ? "#dc2626"
                    : "#059669"
                };
                font-size:15px;
              "
            >
              ₹${formatCurrency(balance)}
            </strong>
          </div>

        </div>

        <!-- STATUS -->

        <div style="
          display:flex;
          justify-content:space-between;
          margin-top:25px;
          padding:14px 0;
          border-top:1px solid #e5e7eb;
          border-bottom:1px solid #e5e7eb;
        ">

          <span style="
            font-size:13px;
            font-weight:600;
            color:#475569;
          ">
            Payment Status
          </span>

          <strong style="
            color:${
              balance > 0
                ? "#f59e0b"
                : "#059669"
            };
            font-size:13px;
          ">
            ${
              balance > 0
                ? "⚠ PARTIALLY PAID"
                : "✓ PAID"
            }
          </strong>

        </div>

        <!-- NOTES -->

        ${
          formData.notes
            ? `
              <div style="
                margin-top:25px;
                padding:14px;
                background:#f8fafc;
                border:1px solid #e2e8f0;
                border-radius:6px;
              ">

                <div style="
                  font-size:12px;
                  color:#64748b;
                  margin-bottom:6px;
                  font-weight:600;
                ">
                  NOTES
                </div>

                <div style="
                  font-size:13px;
                  color:#334155;
                ">
                  ${formData.notes}
                </div>

              </div>
            `
            : ""
        }

        <!-- SIGNATURE -->

        <div style="
          display:flex;
          justify-content:flex-end;
          margin-top:55px;
        ">

          <div style="
            width:190px;
            text-align:center;
          ">

            <div style="
              border-top:1px solid #111827;
              margin-bottom:8px;
            "></div>

            <div style="
              font-size:12px;
              color:#475569;
            ">
              Authorized Signature
            </div>

          </div>

        </div>

        <!-- FOOTER -->

        <div style="
          margin-top:38px;
          padding-top:18px;
          border-top:1px solid #e5e7eb;
          text-align:center;
          font-size:12px;
          color:#64748b;
        ">
          Thank you for your payment
        </div>

      </div>
    `;

    receiptElement.innerHTML = buildModernPaymentReceiptHtml({
      logoUrl: `${window.location.origin}/logo.png`,
      instituteName,
      branchName,
      branchAddress,
      branchPhone,
      branchEmail,
      studentName,
      admissionId,
      courseName,
      batchName,
      studentPhone,
      receiptNumber,
      receiptDate,
      paymentDate: formatDateDMY(formData.paymentDate),
      paymentFor: formData.payAgainst,
      paymentMode: formData.paymentMode,
      transactionReference: formData.transactionReference,
      collectedBy: formData.collectedBy,
      notes: formData.notes,
      totalCourseFee,
      previouslyPaid,
      currentPayment,
      totalPaid,
      balance,
      amountInWords,
      installments,
      paymentAlreadyApplied: paymentSaved,
    });

    document.body.appendChild(
      receiptElement
    );

    const pdfOptions = {
      margin: 0,

      filename: `Payment_Receipt_${receiptNumber}.pdf`,

      image: {
        type: "jpeg",
        quality: 0.98,
      },

      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      },

      jsPDF: {
        unit: "px",
        format: [800, 1150],
        orientation: "portrait",
      },
    };

    html2pdf()
      .set(pdfOptions)
      .from(receiptElement)
      .toPdf()
      .get("pdf")
      .then(async (pdf) => {
        const dataUri = pdf.output("datauristring");
        const pdfBase64 = String(dataUri || "").split(",")[1] || "";
        pdf.save(pdfOptions.filename);
        if (
          document.body.contains(
            receiptElement
          )
        ) {
          document.body.removeChild(
            receiptElement
          );
        }

        // IMPORTANT:
        // Save payment only after PDF download.

        const isSaved = await savePaymentToBackend({
          filename: pdfOptions.filename,
          content: pdfBase64,
          contentType: "application/pdf",
        });

        if (isSaved) {
          setShowPaymentSuccess(true);
          setShowReceipt(false);
        } else {
          setShowReceipt(true);
        }
      })
      .catch((error) => {
        console.error(
          "Receipt PDF generation failed:",
          error
        );

        if (
          document.body.contains(
            receiptElement
          )
        ) {
          document.body.removeChild(
            receiptElement
          );
        }

        alert(
          "Unable to generate receipt PDF."
        );

        setShowReceipt(true);
      })
      .finally(() => {
        setIsGeneratingReceipt(false);
      });
  };

  // =========================================================
  // CLOSE RECEIPT
  // =========================================================

  const handleCloseReceipt = () => {
    if (!paymentSaved) {
      const confirmClose =
        window.confirm(
          "⚠️ Payment has NOT been saved yet!\n\nPlease download the receipt first to save the payment.\n\nAre you sure you want to close without saving?"
        );

      if (!confirmClose) {
        return;
      }
    }

    setShowReceipt(false);

    onClose?.();
  };

  // =========================================================
  // CLOSE SUCCESS POPUP
  // =========================================================

  const handleCloseSuccessPopup = () => {
    setShowPaymentSuccess(false);
    setShowReceipt(false);
    onClose?.();
  };

  // =========================================================
  // CLOSE FORM
  // =========================================================

  const handleCloseForm = () => {
    if (
      !showConfirmation &&
      !showReceipt
    ) {
      onClose();
    }
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <>
      {/* =====================================================
          RECORD PAYMENT PANEL
      ===================================================== */}

      {!showReceipt && !showPaymentSuccess ? (
        <div className="record-payment-overlay">

          <div className="record-payment-modal">

          {/* HEADER */}

          <div className="record-payment-header">

            <div>
              <h2>
                Record Payment
              </h2>

              <p>
                Record a payment for this student
              </p>
            </div>

            <button
              type="button"
              className="record-payment-close"
              onClick={handleCloseForm}
            >
              ×
            </button>

          </div>

          {/* FORM */}

          <form onSubmit={handleSubmit}>

            {/* =================================================
                STUDENT
            ================================================= */}

            <div className="payment-form-group">

              <label htmlFor="studentId">
                Student{" "}
                <span className="required-star">
                  *
                </span>
              </label>

              {activeStudent?.studentId ? (

                <div className="payment-readonly-field">

                  <span>
                    {studentName}
                  </span>

                  <span className="payment-student-id">
                    {activeStudent.studentId}
                  </span>

                </div>

              ) : (

                <>

                  <div className="payment-student-search">

                    <div className="payment-student-search-row">

                      <input
                        type="text"
                        id="studentId"
                        value={studentIdInput}
                      onChange={(event) => {
                          const nextValue = event.target.value;
                          setStudentIdInput(nextValue);
                          setStudentLookupError("");
                          const hasQuery = Boolean(nextValue.trim());
                          setShowStudentSuggestions(hasQuery);

                          if (!hasQuery) {
                            setStudentSearchResults([]);
                          }
                        }}
                        onFocus={() => {
                          if (studentSearchResults.length > 0 && studentIdInput.trim()) {
                            setShowStudentSuggestions(true);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleStudentLookup();
                          }
                        }}
                        placeholder="Enter Student ID or Name"
                        aria-autocomplete="list"
                        aria-expanded={showStudentSuggestions}
                        aria-controls="student-search-results"
                      />

                      <button
                        type="button"
                        className="button button-solid"
                        onClick={handleStudentLookup}
                        disabled={isLoadingStudent || isSearchingStudents}
                      >
                        {isLoadingStudent || isSearchingStudents
                          ? "Searching..."
                          : "Search"}
                      </button>

                    </div>

                    {showStudentSuggestions &&
                      studentIdInput.trim() &&
                      studentSearchResults.length > 0 && (
                        <div
                          className="payment-student-search-dropdown"
                          id="student-search-results"
                          role="listbox"
                          aria-label="Student search results"
                        >
                          {studentSearchResults.map((result) => (
                            <button
                              key={String(result?.id || result?.studentId || formatStudentSuggestionLabel(result))}
                              type="button"
                              className="payment-student-search-option"
                              role="option"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectStudent(result);
                              }}
                            >
                              <span className="payment-student-search-option-name">
                                {formatStudentSuggestionLabel(result)}
                              </span>
                              <span className="payment-student-search-option-meta">
                                {String(result?.courseName || result?.courseInterested || result?.batchName || "").trim()}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                    {showStudentSuggestions &&
                      studentIdInput.trim() &&
                      !isSearchingStudents &&
                      studentSearchResults.length === 0 && (
                        <div className="payment-student-search-empty">
                          No students found for "{studentIdInput.trim()}".
                        </div>
                      )}

                  </div>

                  {studentLookupError && (
                    <span className="payment-error">
                      {studentLookupError}
                    </span>
                  )}

                </>

              )}

              {errors.student && (
                <span className="payment-error">
                  {errors.student}
                </span>
              )}

            </div>

            {/* =================================================
                PAY AGAINST
            ================================================= */}

            <div className="payment-form-group">

              <label htmlFor="payAgainst">
                Pay Against{" "}
                <span className="required-star">
                  *
                </span>
              </label>

              <select
                id="payAgainst"
                name="payAgainst"
                value={formData.payAgainst}
                onChange={handleChange}
              >

                <option value="">
                  Select payment against
                </option>

                <option value="Installment 1">
                  Installment 1
                </option>

                <option value="Installment 2">
                  Installment 2
                </option>

                <option value="Installment 3">
                  Installment 3
                </option>

                

              </select>

              {errors.payAgainst && (
                <span className="payment-error">
                  {errors.payAgainst}
                </span>
              )}

            </div>

            {/* =================================================
                AMOUNT ROW
            ================================================= */}

            <div className="payment-form-row">

              {/* AMOUNT TO PAY */}

              <div className="payment-form-group">

                <label htmlFor="amountToPay">
                  Amount to Pay{" "}
                  <span className="required-star">
                    *
                  </span>
                </label>

                <div className="payment-input-wrapper">

                  <span className="currency-symbol">
                    ₹
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    id="amountToPay"
                    name="amountToPay"
                    value={
                      formData.amountToPay
                    }
                    onChange={handleChange}
                    readOnly
                    aria-readonly="true"
                    placeholder="0.00"
                  />

                </div>

                {errors.amountToPay && (
                  <span className="payment-error">
                    {errors.amountToPay}
                  </span>
                )}

              </div>

              {/* AMOUNT RECEIVED */}

              <div className="payment-form-group">

                <label htmlFor="amountReceived">
                  Amount Received{" "}
                  <span className="required-star">
                    *
                  </span>
                </label>

                <div className="payment-input-wrapper">

                  <span className="currency-symbol">
                    ₹
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    id="amountReceived"
                    name="amountReceived"
                    value={
                      formData.amountReceived
                    }
                    onChange={handleChange}
                    placeholder="0.00"
                  />

                </div>

                {errors.amountReceived && (
                  <span className="payment-error">
                    {errors.amountReceived}
                  </span>
                )}

              </div>

            </div>

            {/* =================================================
                PAYMENT MODE
            ================================================= */}

            <div className="payment-form-group">

              <label htmlFor="paymentMode">
                Payment Mode{" "}
                <span className="required-star">
                  *
                </span>
              </label>

              <select
                id="paymentMode"
                name="paymentMode"
                value={
                  formData.paymentMode
                }
                onChange={handleChange}
              >

                <option value="">
                  Select payment mode
                </option>

                <option value="Cash">
                  Cash
                </option>

                <option value="UPI">
                  UPI
                </option>

                <option value="Card">
                  Card
                </option>

                <option value="Bank">
                  Bank
                </option>

                <option value="Cheque">
                  Cheque
                </option>

              </select>

              {errors.paymentMode && (
                <span className="payment-error">
                  {errors.paymentMode}
                </span>
              )}

            </div>

            {formData.paymentMode !== "Cash" ? (
              <div className="payment-form-group">

                <label htmlFor="transactionReference">
                  Transaction Reference
                </label>

                <input
                  type="text"
                  id="transactionReference"
                  name="transactionReference"
                  value={
                    formData.transactionReference
                  }
                  onChange={handleChange}
                  placeholder="Enter transaction reference"
                />

              </div>
            ) : null}

            {/* =================================================
                PAYMENT DATE
            ================================================= */}

            <div className="payment-form-group">

              <label htmlFor="paymentDate">
                Payment Date{" "}
                <span className="required-star">
                  *
                </span>
              </label>

              <input
                type="date"
                id="paymentDate"
                name="paymentDate"
                value={
                  formData.paymentDate
                }
                onChange={handleChange}
              />

              {errors.paymentDate && (
                <span className="payment-error">
                  {errors.paymentDate}
                </span>
              )}

            </div>

            {/* =================================================
                COLLECTED BY
            ================================================= */}

            <div className="payment-form-group">

              <label htmlFor="collectedBy">
                Collected By{" "}
                <span className="required-star">
                  *
                </span>
              </label>

              <input
                type="text"
                id="collectedBy"
                name="collectedBy"
                value={
                  formData.collectedBy
                }
                onChange={handleChange}
                placeholder="Enter collector name"
              />

              {errors.collectedBy && (
                <span className="payment-error">
                  {errors.collectedBy}
                </span>
              )}

            </div>

            {/* =================================================
                BRANCH
            ================================================= */}

            <div className="payment-form-group">

              <label htmlFor="branch">
                Branch{" "}
                <span className="required-star">
                  *
                </span>
              </label>

              <input
                type="text"
                id="branch"
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                placeholder="Enter branch name"
              />

              {errors.branch && (
                <span className="payment-error">
                  {errors.branch}
                </span>
              )}

            </div>

            {/* =================================================
                NOTES
            ================================================= */}

            <div className="payment-form-group">

              <label htmlFor="notes">
                Notes
              </label>

              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Enter notes"
                rows="3"
              />

            </div>

            {/* =================================================
                PAYMENT PROOF
            ================================================= */}

            <div className="payment-form-group">

              <label htmlFor="paymentProof">
                Payment Proof
              </label>

              <div className="payment-file-upload">

                <input
                  type="file"
                  id="paymentProof"
                  onChange={
                    handleFileChange
                  }
                />

                <span>
                  {formData.paymentProof
                    ? formData.paymentProof.name
                    : "Upload payment proof"}
                </span>

              </div>

            </div>

            {/* =================================================
                FOOTER
            ================================================= */}

            <div className="record-payment-footer">

              <button
                type="button"
                className="payment-cancel-btn"
                onClick={handleCloseForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="payment-save-btn"
              >
                Save Payment
              </button>

            </div>

          </form>

          </div>
        </div>
      ) : null}

      {/* =====================================================
          CONFIRMATION POPUP
      ===================================================== */}

      {showConfirmation && (

        <div className="payment-popup-overlay">

          <div className="payment-confirmation-popup">

            <button
              type="button"
              className="receipt-popup-close"
              aria-label="Close confirmation popup"
              onClick={() =>
                setShowConfirmation(false)
              }
            >
              x
            </button>

            <h3>
              Confirm Payment
            </h3>

            <p className="payment-popup-description">
              Please review the payment details
              before confirming.
            </p>

            <div className="confirmation-details">

              <div className="confirmation-detail-row">
                <span>
                  Student
                </span>

                <strong>
                  {studentName}
                </strong>
              </div>

              <div className="confirmation-detail-row">
                <span>
                  Pay Against
                </span>

                <strong>
                  {formData.payAgainst}
                </strong>
              </div>

              <div className="confirmation-detail-row">
                <span>
                  Amount Received
                </span>

                <strong className="confirmation-amount">
                  ₹
                  {formatCurrency(
                    currentPayment
                  )}
                </strong>
              </div>

              <div className="confirmation-detail-row">
                <span>
                  Payment Mode
                </span>

                <strong>
                  {formData.paymentMode}
                </strong>
              </div>

              <div className="confirmation-detail-row">
                <span>
                  Payment Date
                </span>

                <strong>
                  {formatDateDMY(
                    formData.paymentDate
                  )}
                </strong>
              </div>

            </div>

            <div className="payment-popup-actions">

              <button
                type="button"
                className="popup-cancel-btn"
                onClick={() =>
                  setShowConfirmation(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="popup-confirm-btn"
                onClick={
                  handleConfirmPayment
                }
              >
                Confirm Payment
              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          RECEIPT SUCCESS POPUP
      ===================================================== */}

      {showReceipt && (

        <div className="payment-popup-overlay">

          <div className="payment-receipt-popup">

            <button
              type="button"
              className="receipt-popup-close"
              onClick={
                handleCloseReceipt
              }
            >
              ×
            </button>

            <div className="payment-success-icon">
              ✓
            </div>

            <h3>
              Payment Recorded Successfully
            </h3>

            <p className="payment-popup-description">
              {paymentSaved
                ? "The payment has been successfully recorded."
                : "Download the receipt to save the payment."}
            </p>

            <div className="receipt-number-box">

              <span>
                Receipt Number
              </span>

              <strong>
                {receiptNumber}
              </strong>

            </div>

            {/* RECEIPT SUMMARY */}

            <div className="receipt-summary">

              <div className="receipt-summary-row">
                <span>
                  Student
                </span>

                <strong>
                  {studentName}
                </strong>
              </div>

              <div className="receipt-summary-row">
                <span>
                  Course
                </span>

                <strong>
                  {courseName}
                </strong>
              </div>

              <div className="receipt-summary-row">
                <span>
                  Pay Against
                </span>

                <strong>
                  {formData.payAgainst}
                </strong>
              </div>

              <div className="receipt-summary-row">
                <span>
                  Payment Mode
                </span>

                <strong>
                  {formData.paymentMode}
                </strong>
              </div>

              <div className="receipt-summary-row">
                <span>
                  Payment Date
                </span>

                <strong>
                  {formatDateDMY(
                    formData.paymentDate
                  )}
                </strong>
              </div>

              <div
                className="receipt-summary-row"
                style={{
                  borderTop:
                    "1px solid #e5e7eb",
                  paddingTop: "12px",
                  marginTop: "8px",
                }}
              >
                <span>
                  Total Course Fee
                </span>

                <strong>
                  ₹
                  {formatCurrency(
                    totalCourseFee
                  )}
                </strong>
              </div>

              <div className="receipt-summary-row">

                <span>
                  Previously Paid
                </span>

                <strong>
                  ₹
                  {formatCurrency(
                    previouslyPaid
                  )}
                </strong>

              </div>

              <div className="receipt-total-row">

                <span>
                  Amount Received
                </span>

                <strong>
                  ₹
                  {formatCurrency(
                    currentPayment
                  )}
                </strong>

              </div>

              {installmentBalance > 0 && (

                <div
                  className="receipt-summary-row"
                  style={{
                    color: "#dc2626",
                  }}
                >

                  <span>
                    Installment Balance
                  </span>

                  <strong
                    style={{
                      color: "#dc2626",
                    }}
                  >
                    ₹
                    {formatCurrency(
                      installmentBalance
                    )}
                  </strong>

                </div>

              )}

              <div
                className="receipt-summary-row"
                style={{
                  borderTop:
                    "1px solid #e5e7eb",
                  paddingTop: "12px",
                  marginTop: "8px",
                }}
              >

                <span>
                  Total Paid (Overall)
                </span>

                <strong>
                  ₹
                  {formatCurrency(
                    totalPaid
                  )}
                </strong>

              </div>

              <div
                className="receipt-summary-row"
                style={{
                  color:
                    balance > 0
                      ? "#dc2626"
                      : "#059669",
                }}
              >

                <span>
                  <strong>
                    Overall Balance
                  </strong>
                </span>

                <strong
                  style={{
                    color:
                      balance > 0
                        ? "#dc2626"
                        : "#059669",

                    fontSize: "16px",
                  }}
                >
                  ₹
                  {formatCurrency(
                    balance
                  )}
                </strong>

              </div>

            </div>

            {/* SAVE STATUS */}

            {paymentSaved ? (

              <div
                style={{
                  background:
                    "#ecfdf5",

                  border:
                    "1px solid #a7f3d0",

                  borderRadius: "8px",

                  padding: "10px 16px",

                  marginBottom: "12px",

                  color: "#065f46",

                  fontSize: "13px",

                  fontWeight: 600,

                  textAlign: "center",
                }}
              >
                ✓ Payment saved successfully!
              </div>

            ) : (

              <div
                style={{
                  background:
                    "#fef3c7",

                  border:
                    "1px solid #fcd34d",

                  borderRadius: "8px",

                  padding: "10px 16px",

                  marginBottom: "12px",

                  color: "#92400e",

                  fontSize: "13px",

                  fontWeight: 600,

                  textAlign: "center",
                }}
              >
                ⚠ Click "Save Payment" to complete the payment.
              </div>

            )}

            {/* ACTIONS */}

            <div className="receipt-popup-actions">

              <button
                type="button"
                className="receipt-close-btn"
                onClick={
                  handleCloseReceipt
                }
              >
                {paymentSaved
                  ? "Close"
                  : "Cancel"}
              </button>

              <button
                type="button"
                className="generate-receipt-btn"
                onClick={
                  handleGenerateReceipt
                }
                disabled={
                  isSavingPayment ||
                  isGeneratingReceipt
                }
              >
                {isSavingPayment ||
                isGeneratingReceipt
                  ? "Saving Payment..."
                  : paymentSaved
                  ? "↓ Download Receipt Again"
                  : "↓ Download Receipt & Save Payment"}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          PAYMENT SUCCESS POPUP
      ===================================================== */}

      {showPaymentSuccess && (

        <div className="payment-popup-overlay">

          <div className="payment-success-popup" role="dialog" aria-modal="true" aria-labelledby="payment-success-title">

            <button
              type="button"
              className="receipt-popup-close payment-success-close"
              aria-label="Close success popup"
              onClick={handleCloseSuccessPopup}
            >
              Ã—
            </button>

            <div className="payment-success-icon">
              ✓
            </div>

            <h3 id="payment-success-title">
              Payment saved successfully
            </h3>

            <p className="payment-popup-description">
              The receipt has been downloaded and the payment has been completed successfully.
            </p>

            <div className="payment-success-actions">
              <button
                type="button"
                className="payment-success-btn"
                onClick={handleCloseSuccessPopup}
              >
                OK
              </button>
            </div>

          </div>

        </div>

      )}

    </>
  );
};

export default RecordPayment;

