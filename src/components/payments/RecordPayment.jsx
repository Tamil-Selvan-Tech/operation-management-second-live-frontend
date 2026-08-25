import React, { useState } from "react";
import "./RecordPayment.css";

const RecordPayment = ({ student, onClose }) => {
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

  const [errors, setErrors] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState("");

  // =========================================================
  // STUDENT DATA
  // =========================================================

  const studentName =
    student?.studentName ||
    student?.name ||
    "Student Name";

  const admissionId =
    student?.admissionId ||
    student?.admissionID ||
    student?.studentId ||
    "ADM-2026-001";

  const courseName =
    student?.courseName ||
    student?.course ||
    student?.selectedCourse ||
    "Data Analytics";

  // =========================================================
  // FEE DATA
  // =========================================================

  const totalCourseFee = Number(
    student?.totalCourseFee ||
      student?.courseFee ||
      student?.totalFees ||
      student?.totalAmount ||
      0
  );

  const previouslyPaid = Number(
    student?.previouslyPaid ||
      student?.paidAmount ||
      student?.totalPaid ||
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
  // FORMAT CURRENCY
  // =========================================================

  const formatCurrency = (amount) => {
    return Number(amount || 0).toLocaleString("en-IN");
  };

  // =========================================================
  // AMOUNT TO WORDS
  // =========================================================

  const numberToWords = (number) => {
    number = Number(number);

    if (!number || number === 0) {
      return "Zero Rupees Only";
    }

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
        result += ones[Math.floor(num / 100)] + " Hundred ";
        num %= 100;
      }

      if (num >= 20) {
        result += tens[Math.floor(num / 10)] + " ";
        num %= 10;
      }

      if (num > 0) {
        result += ones[num] + " ";
      }

      return result.trim();
    };

    let result = "";

    const crore = Math.floor(number / 10000000);
    number %= 10000000;

    const lakh = Math.floor(number / 100000);
    number %= 100000;

    const thousand = Math.floor(number / 1000);
    number %= 1000;

    if (crore > 0) {
      result +=
        convertBelowThousand(crore) + " Crore ";
    }

    if (lakh > 0) {
      result +=
        convertBelowThousand(lakh) + " Lakh ";
    }

    if (thousand > 0) {
      result +=
        convertBelowThousand(thousand) + " Thousand ";
    }

    if (number > 0) {
      result += convertBelowThousand(number);
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

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // =========================================================
  // HANDLE INPUT CHANGE
  // =========================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (
      name === "amountToPay" ||
      name === "amountReceived"
    ) {
      if (!/^\d*\.?\d*$/.test(value)) {
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  // =========================================================
  // FILE CHANGE
  // =========================================================

  const handleFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      paymentProof: e.target.files[0] || null,
    }));
  };

  // =========================================================
  // FORM VALIDATION
  // =========================================================

  const validateForm = () => {
    const newErrors = {};

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

    return Object.keys(newErrors).length === 0;
  };

  // =========================================================
  // SAVE PAYMENT
  // =========================================================

  const handleSubmit = (e) => {
    e.preventDefault();

    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    setShowConfirmation(true);
  };

  // =========================================================
  // CONFIRM PAYMENT
  // =========================================================

  const handleConfirmPayment = () => {
    /*
      Temporary receipt number.

      Backend connect pannumbothu:
      backend generated receipt number use pannalam.
    */

    const generatedReceiptNumber =
      `REC-${new Date().getFullYear()}-${String(
        Date.now()
      ).slice(-4)}`;

    setReceiptNumber(
      generatedReceiptNumber
    );

    console.log("Payment Confirmed:", {
      student,
      ...formData,
      receiptNumber:
        generatedReceiptNumber,
    });

    setShowConfirmation(false);
    setShowReceipt(true);
  };

  // =========================================================
  // GENERATE RECEIPT
  // =========================================================

 const handleGenerateReceipt = () => {
  const receiptWindow = window.open(
    "",
    "_blank",
    "width=900,height=900"
  );

  if (!receiptWindow) {
    alert(
      "Please allow popups to generate the receipt."
    );
    return;
  }

  const receiptDate = formatDate(
    formData.paymentDate
  );

  const amountInWords =
    numberToWords(currentPayment);

  const instituteName =
    student?.instituteName ||
    "Cispro Training and Placement Pvt Ltd";

  const instituteLocation =
    student?.instituteLocation ||
    formData.branch ||
    "Chennai";

  const institutePhone =
    student?.institutePhone ||
    "+91 XXXXX XXXXX";

  receiptWindow.document.write(`

    
      <!DOCTYPE html>

      <html>

      <head>

        <title>
          Payment Receipt - ${receiptNumber}
        </title>

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <style>

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 35px;
            background: #f8fafc;
            color: #111827;
            font-family:
              Arial,
              Helvetica,
              sans-serif;
          }

          .receipt-container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #dfe3e8;
            border-radius: 8px;
            padding: 38px;
          }

          /* =========================
             INSTITUTE HEADER
          ========================= */

          .institute-header {
            text-align: center;
            margin-bottom: 28px;
          }

          .institute-header h1 {
            margin: 0;
            font-size: 25px;
            font-weight: 700;
            color: #111827;
          }

          .institute-contact {
            margin-top: 7px;
            font-size: 13px;
            color: #64748b;
          }

          .receipt-title {
            margin-top: 24px;
            font-size: 21px;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #0f766e;
          }

          /* =========================
             RECEIPT META
          ========================= */

          .receipt-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            padding: 16px 0;
            border-top: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 26px;
            font-size: 13px;
          }

          .receipt-meta strong {
            color: #111827;
          }

          /* =========================
             SECTION
          ========================= */

          .receipt-section {
            margin-bottom: 25px;
          }

          .section-title {
            margin: 0 0 13px;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.4px;
            color: #334155;
          }

          .detail-row {
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 20px;
            padding: 8px 0;
            font-size: 13px;
          }

          .detail-label {
            color: #64748b;
          }

          .detail-value {
            color: #111827;
            font-weight: 600;
          }

          /* =========================
             DIVIDER
          ========================= */

          .divider {
            border-top: 1px solid #e5e7eb;
            margin: 25px 0;
          }

          /* =========================
             AMOUNT
          ========================= */

          .amount-section {
            padding: 18px 0;
          }

          .amount-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
          }

          .amount-label {
            font-size: 14px;
            font-weight: 600;
            color: #475569;
          }

          .amount-value {
            font-size: 24px;
            font-weight: 700;
            color: #0f766e;
          }

          .amount-words {
            margin-top: 12px;
          }

          .amount-words-label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 5px;
          }

          .amount-words-value {
            font-size: 13px;
            font-weight: 600;
            color: #334155;
          }

          /* =========================
             FEE SUMMARY
          ========================= */

          .fee-summary {
            width: 100%;
          }

          .fee-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 9px 0;
            font-size: 13px;
          }

          .fee-row span:first-child {
            color: #64748b;
          }

          .fee-row span:last-child {
            font-weight: 600;
            color: #111827;
          }

          .fee-row.total {
            border-top: 1px solid #cbd5e1;
            margin-top: 5px;
            padding-top: 13px;
          }

          .fee-row.total span {
            font-weight: 700;
            color: #111827;
          }

          .fee-row.balance {
            padding-bottom: 0;
          }

          .fee-row.balance span:last-child {
            color: #dc2626;
            font-size: 15px;
          }

          /* =========================
             STATUS
          ========================= */

          .payment-status {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 25px;
            padding: 14px 0;
            border-top: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
          }

          .status-label {
            font-size: 13px;
            font-weight: 600;
            color: #475569;
          }

          .status-paid {
            color: #059669;
            font-size: 13px;
            font-weight: 700;
          }

          /* =========================
             SIGNATURE
          ========================= */

          .signature-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 55px;
          }

          .signature-box {
            width: 190px;
            text-align: center;
          }

          .signature-line {
            border-top: 1px solid #111827;
            margin-bottom: 8px;
          }

          .signature-text {
            font-size: 12px;
            color: #475569;
          }

          /* =========================
             FOOTER
          ========================= */

          .receipt-footer {
            margin-top: 38px;
            padding-top: 18px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 12px;
            color: #64748b;
          }

          /* =========================
             PRINT
          ========================= */

          @media print {

            body {
              padding: 0;
              background: #ffffff;
            }

            .receipt-container {
              max-width: none;
              border: none;
              border-radius: 0;
              padding: 20px;
            }

          }

          @media (max-width: 600px) {

            body {
              padding: 10px;
            }

            .receipt-container {
              padding: 22px;
            }

            .receipt-meta {
              flex-direction: column;
              align-items: flex-start;
              gap: 8px;
            }

            .detail-row {
              grid-template-columns: 1fr;
              gap: 3px;
            }

          }

        </style>

      </head>

      <body>

        <div class="receipt-container">

          <!-- =========================
               INSTITUTE HEADER
          ========================== -->

          <div class="institute-header">

            <h1>
              ${instituteName}
            </h1>

            <div class="institute-contact">
              ${instituteLocation}
              •
              ${institutePhone}
            </div>

            <div class="receipt-title">
              PAYMENT RECEIPT
            </div>

          </div>

          <!-- =========================
               RECEIPT META
          ========================== -->

          <div class="receipt-meta">

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

          <!-- =========================
               STUDENT DETAILS
          ========================== -->

          <div class="receipt-section">

            <h3 class="section-title">
              STUDENT DETAILS
            </h3>

            <div class="detail-row">
              <div class="detail-label">
                Student Name
              </div>

              <div class="detail-value">
                ${studentName}
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                Admission ID
              </div>

              <div class="detail-value">
                ${admissionId}
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                Course
              </div>

              <div class="detail-value">
                ${courseName}
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                Branch
              </div>

              <div class="detail-value">
                ${formData.branch}
              </div>
            </div>

          </div>

          <div class="divider"></div>

          <!-- =========================
               PAYMENT DETAILS
          ========================== -->

          <div class="receipt-section">

            <h3 class="section-title">
              PAYMENT DETAILS
            </h3>

            <div class="detail-row">

              <div class="detail-label">
                Payment For
              </div>

              <div class="detail-value">
                ${formData.payAgainst}
              </div>

            </div>

            <div class="detail-row">

              <div class="detail-label">
                Payment Mode
              </div>

              <div class="detail-value">
                ${formData.paymentMode}
              </div>

            </div>

            <div class="detail-row">

              <div class="detail-label">
                Transaction Ref
              </div>

              <div class="detail-value">
                ${
                  formData.transactionReference ||
                  "-"
                }
              </div>

            </div>

            <div class="detail-row">

              <div class="detail-label">
                Collected By
              </div>

              <div class="detail-value">
                ${formData.collectedBy}
              </div>

            </div>

          </div>

          <div class="divider"></div>

          <!-- =========================
               AMOUNT RECEIVED
          ========================== -->

          <div class="amount-section">

            <div class="amount-row">

              <div class="amount-label">
                Amount Received
              </div>

              <div class="amount-value">
                ₹${formatCurrency(
                  currentPayment
                )}
              </div>

            </div>

            <div class="amount-words">

              <div class="amount-words-label">
                Amount in Words
              </div>

              <div class="amount-words-value">
                ${amountInWords}
              </div>

            </div>

          </div>

          <div class="divider"></div>

          <!-- =========================
               FEE SUMMARY
          ========================== -->

          <div class="receipt-section">

            <h3 class="section-title">
              FEE SUMMARY
            </h3>

            <div class="fee-summary">

              <div class="fee-row">

                <span>
                  Total Course Fee
                </span>

                <span>
                  ₹${formatCurrency(
                    totalCourseFee
                  )}
                </span>

              </div>

              <div class="fee-row">

                <span>
                  Previously Paid
                </span>

                <span>
                  ₹${formatCurrency(
                    previouslyPaid
                  )}
                </span>

              </div>

              <div class="fee-row">

                <span>
                  This Payment
                </span>

                <span>
                  ₹${formatCurrency(
                    currentPayment
                  )}
                </span>

              </div>

              <div class="fee-row total">

                <span>
                  Total Paid
                </span>

                <span>
                  ₹${formatCurrency(
                    totalPaid
                  )}
                </span>

              </div>

              <div class="fee-row balance">

                <span>
                  Balance
                </span>

                <span>
                  ₹${formatCurrency(
                    balance
                  )}
                </span>

              </div>

            </div>

          </div>

          <!-- =========================
               PAYMENT STATUS
          ========================== -->

          <div class="payment-status">

            <div class="status-label">
              Payment Status
            </div>

            <div class="status-paid">
              ✓ PAID
            </div>

          </div>

          <!-- =========================
               SIGNATURE
          ========================== -->

          <div class="signature-section">

            <div class="signature-box">

              <div class="signature-line"></div>

              <div class="signature-text">
                Authorized Signature
              </div>

            </div>

          </div>

          <!-- =========================
               FOOTER
          ========================== -->

          <div class="receipt-footer">
            Thank you for your payment
          </div>

        </div>

        <script>

          window.onload = function () {
  console.log("Receipt loaded");
};

        </script>

      </body>

      </html>
    `);

    receiptWindow.document.close();
  };

  // =========================================================
  // CLOSE RECEIPT
  // =========================================================

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    onClose();
  };

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
              onClick={onClose}
            >
              ×
            </button>

          </div>

          {/* FORM */}

          <form onSubmit={handleSubmit}>

            {/* STUDENT */}

            <div className="payment-form-group">

              <label>
                Student{" "}
                <span className="required-star">
                  *
                </span>
              </label>

              <div className="payment-readonly-field">

                <span>
                  {studentName}
                </span>

                {student?.studentId && (
                  <span className="payment-student-id">
                    {student.studentId}
                  </span>
                )}

              </div>

            </div>

            {/* PAY AGAINST */}

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

            {/* AMOUNT ROW */}

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
                    value={formData.amountToPay}
                    onChange={handleChange}
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
                    value={formData.amountReceived}
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

            {/* PAYMENT MODE */}

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
                value={formData.paymentMode}
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

            {/* TRANSACTION REFERENCE */}

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

            {/* PAYMENT DATE */}

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
                value={formData.paymentDate}
                onChange={handleChange}
              />

              {errors.paymentDate && (
                <span className="payment-error">
                  {errors.paymentDate}
                </span>
              )}

            </div>

            {/* COLLECTED BY */}

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
                value={formData.collectedBy}
                onChange={handleChange}
                placeholder="Enter collector name"
              />

              {errors.collectedBy && (
                <span className="payment-error">
                  {errors.collectedBy}
                </span>
              )}

            </div>

            {/* BRANCH */}

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

            {/* NOTES */}

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

            {/* PAYMENT PROOF */}

            <div className="payment-form-group">

              <label htmlFor="paymentProof">
                Payment Proof
              </label>

              <div className="payment-file-upload">

                <input
                  type="file"
                  id="paymentProof"
                  onChange={handleFileChange}
                />

                <span>

                  {formData.paymentProof
                    ? formData.paymentProof.name
                    : "Upload payment proof"}

                </span>

              </div>

            </div>

            {/* FOOTER */}

            <div className="record-payment-footer">

              <button
                type="button"
                className="payment-cancel-btn"
                onClick={onClose}
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

            <div className="payment-popup-icon confirmation-icon">
              ?
            </div>

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
                  {formatDate(
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
              The payment has been successfully
              recorded.
            </p>

            <div className="receipt-number-box">

              <span>
                Receipt Number
              </span>

              <strong>
                {receiptNumber}
              </strong>

            </div>

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
                  {formatDate(
                    formData.paymentDate
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

            </div>

            <div className="receipt-popup-actions">

              <button
                type="button"
                className="receipt-close-btn"
                onClick={
                  handleCloseReceipt
                }
              >
                Close
              </button>

              <button
                type="button"
                className="generate-receipt-btn"
                onClick={
                  handleGenerateReceipt
                }
              >
                Generate Receipt
              </button>

            </div>

          </div>

        </div>
      )}

    </>
  );
};

export default RecordPayment;