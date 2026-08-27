import React, { useEffect, useState } from "react";
import "./RecordPayment.css";
import html2pdf from "html2pdf.js";
import { request } from "../../services/apiClient";

const RecordPayment = ({ student, onClose }) => {
  // =========================================================
  // FORM DATA
  // =========================================================

  const [formData, setFormData] = useState({
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
  });

  // =========================================================
  // STATE
  // =========================================================

  const [errors, setErrors] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const [receiptNumber, setReceiptNumber] = useState("");

  const [paymentSaved, setPaymentSaved] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const [studentIdInput, setStudentIdInput] = useState(
    student?.studentId || ""
  );

  const [selectedStudent, setSelectedStudent] = useState(student || null);

  const [isLoadingStudent, setIsLoadingStudent] = useState(false);
  const [studentLookupError, setStudentLookupError] = useState("");

  // =========================================================
  // ACTIVE STUDENT
  // =========================================================

  const activeStudent = selectedStudent || student || {};

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

  // =========================================================
  // AUTO SELECT FIRST PENDING INSTALLMENT
  // =========================================================

  useEffect(() => {
    if (!activeStudent?.installmentSchedule) {
      return;
    }

    if (
      !Array.isArray(
        activeStudent.installmentSchedule
      )
    ) {
      return;
    }

    const pendingInstallment =
      activeStudent.installmentSchedule.find(
        (installment) => {
          const status = String(
            installment?.status || ""
          ).toLowerCase();

          return status !== "paid";
        }
      );

    if (!pendingInstallment) {
      return;
    }

    const amount = Number(
      pendingInstallment?.amount || 0
    );

    const amountPaid = Number(
      pendingInstallment?.amountPaid ??
        pendingInstallment?.paidAmount ??
        0
    );

    const pendingAmount = Math.max(
      amount - amountPaid,
      0
    );

    setFormData((previous) => ({
      ...previous,

      payAgainst: `Installment ${
        pendingInstallment.installmentNumber
      }`,

      amountToPay: String(pendingAmount),

      amountReceived: String(pendingAmount),
    }));
  }, [activeStudent]);

  // =========================================================
  // STUDENT LOOKUP
  // =========================================================

  const handleStudentLookup = async () => {
    const enteredStudentId =
      studentIdInput.trim();

    if (!enteredStudentId) {
      setStudentLookupError(
        "Please enter Student ID."
      );
      return;
    }

    setIsLoadingStudent(true);
    setStudentLookupError("");

    try {
      const response = await request(
        `/branch-students?studentId=${encodeURIComponent(
          enteredStudentId
        )}`,
        {
          method: "GET",
        }
      );

      const responseData = response?.data;

      let foundStudent = null;

      if (Array.isArray(responseData)) {
        foundStudent = responseData.find(
          (item) =>
            String(
              item?.studentId || ""
            ).toLowerCase() ===
            enteredStudentId.toLowerCase()
        );
      } else {
        foundStudent =
          responseData?.student ||
          responseData?.studentData ||
          responseData;
      }

      if (!foundStudent?.studentId) {
        setStudentLookupError(
          `No student found with ID ${enteredStudentId}.`
        );

        setSelectedStudent(null);

        return;
      }

      setSelectedStudent(foundStudent);

      setStudentLookupError("");

      // Clear previous form errors
      setErrors({});
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

  const formatRupees = (amount) => `₹${formatCurrency(amount)}`;

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

  // =========================================================
  // DATE FORMAT
  // =========================================================

  const formatDate = (dateString) => {
    if (!dateString) {
      return "-";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
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

  const savePaymentToBackend = async () => {
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
          }),
        }
      );

      const savedReceiptNumber =
        response?.data?.receiptNumber ||
        response?.receiptNumber ||
        receiptNumber;

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
    if (isSavingPayment) {
      return;
    }

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
      .save()
      .then(async () => {
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

        await savePaymentToBackend();
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

    onClose();
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

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "stretch",
                    }}
                  >

                    <input
                      type="text"
                      id="studentId"
                      value={studentIdInput}
                      onChange={(event) => {
                        setStudentIdInput(
                          event.target.value
                        );

                        setStudentLookupError("");
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter"
                        ) {
                          event.preventDefault();

                          handleStudentLookup();
                        }
                      }}
                      placeholder="Enter Student ID"
                    />

                    <button
                      type="button"
                      className="button button-solid"
                      onClick={
                        handleStudentLookup
                      }
                      disabled={
                        isLoadingStudent
                      }
                    >
                      {isLoadingStudent
                        ? "Loading..."
                        : "Search"}
                    </button>

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

                <option value="General Balance">
                  General Balance
                </option>

                <option value="Fee Head">
                  Fee Head
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
                  isSavingPayment
                }
              >
                {isSavingPayment
                  ? "Saving Payment..."
                  : paymentSaved
                  ? "↓ Download Receipt Again"
                  : "↓ Download Receipt & Save Payment"}
              </button>

            </div>

          </div>

        </div>

      )}

    </>
  );
};

export default RecordPayment;

