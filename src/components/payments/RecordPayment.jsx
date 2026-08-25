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

  // =========================
  // HANDLE INPUT CHANGE
  // =========================
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Amount fields - numbers + decimal only
    if (name === "amountToPay" || name === "amountReceived") {
      if (!/^\d*\.?\d*$/.test(value)) {
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Remove error when user enters/selects value
    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  // =========================
  // FILE CHANGE
  // =========================
  const handleFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      paymentProof: e.target.files[0] || null,
    }));
  };

  // =========================
  // FORM VALIDATION
  // =========================
  const validateForm = () => {
    const newErrors = {};

    // Pay Against
    if (!formData.payAgainst.trim()) {
      newErrors.payAgainst = "This field is required.";
    }

    // Amount To Pay
    if (!formData.amountToPay.trim()) {
      newErrors.amountToPay = "This field is required.";
    } else if (Number(formData.amountToPay) <= 0) {
      newErrors.amountToPay = "Amount must be greater than 0.";
    }

    // Amount Received
    if (!formData.amountReceived.trim()) {
      newErrors.amountReceived = "This field is required.";
    } else if (Number(formData.amountReceived) <= 0) {
      newErrors.amountReceived = "Amount must be greater than 0.";
    }

    // Payment Mode
    if (!formData.paymentMode.trim()) {
      newErrors.paymentMode = "This field is required.";
    }

    // Payment Date
    if (!formData.paymentDate.trim()) {
      newErrors.paymentDate = "This field is required.";
    }

    // Collected By
    if (!formData.collectedBy.trim()) {
      newErrors.collectedBy = "This field is required.";
    }

    // Branch
    if (!formData.branch.trim()) {
      newErrors.branch = "This field is required.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // =========================
  // SUBMIT
  // =========================
  const handleSubmit = (e) => {
    e.preventDefault();

    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    console.log("Payment Data:", {
      student,
      ...formData,
    });

    // Backend/API connection will be added later
  };

  return (
    <div className="record-payment-overlay">
      <div className="record-payment-modal">

        {/* ================= HEADER ================= */}
        <div className="record-payment-header">
          <div>
            <h2>Record Payment</h2>
            <p>Record a payment for this student</p>
          </div>

          <button
            type="button"
            className="record-payment-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ================= STUDENT ================= */}
          <div className="payment-form-group">
            <label>Student *</label>

            <div className="payment-readonly-field">
              <span>
                {student?.studentName || "Student Name"}
              </span>

              {student?.studentId && (
                <span className="payment-student-id">
                  {student.studentId}
                </span>
              )}
            </div>
          </div>

          {/* ================= PAY AGAINST ================= */}
          <div className="payment-form-group">
            <label htmlFor="payAgainst">
              Pay Against *
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

              <option value="installment-1">
                Installment 1
              </option>

              <option value="installment-2">
                Installment 2
              </option>

              <option value="installment-3">
                Installment 3
              </option>

              <option value="general-balance">
                General Balance
              </option>

              <option value="fee-head">
                Fee Head
              </option>
            </select>

            {errors.payAgainst && (
              <span className="payment-error">
                {errors.payAgainst}
              </span>
            )}
          </div>

          {/* ================= AMOUNT ROW ================= */}
          <div className="payment-form-row">

            {/* Amount To Pay */}
            <div className="payment-form-group">
              <label htmlFor="amountToPay">
                Amount to Pay *
              </label>

              <div className="payment-input-wrapper">
  <span className="currency-symbol">₹</span>

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

            {/* Amount Received */}
            <div className="payment-form-group">
              <label htmlFor="amountReceived">
                Amount Received *
              </label>

              <div className="payment-input-wrapper">
                <span>₹</span>

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

          {/* ================= PAYMENT MODE ================= */}
          <div className="payment-form-group">
            <label htmlFor="paymentMode">
              Payment Mode *
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

              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank</option>
              <option value="cheque">Cheque</option>
            </select>

            {errors.paymentMode && (
              <span className="payment-error">
                {errors.paymentMode}
              </span>
            )}
          </div>

          {/* ================= TRANSACTION REFERENCE ================= */}
          <div className="payment-form-group">
            <label htmlFor="transactionReference">
              Transaction Reference
            </label>

            <input
              type="text"
              id="transactionReference"
              name="transactionReference"
              value={formData.transactionReference}
              onChange={handleChange}
              placeholder="Enter transaction reference"
            />
          </div>

          {/* ================= PAYMENT DATE ================= */}
          <div className="payment-form-group">
            <label htmlFor="paymentDate">
              Payment Date *
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

          {/* ================= COLLECTED BY ================= */}
          <div className="payment-form-group">
            <label htmlFor="collectedBy">
              Collected By *
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

          {/* ================= BRANCH ================= */}
          <div className="payment-form-group">
            <label htmlFor="branch">
              Branch *
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

          {/* ================= NOTES ================= */}
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

          {/* ================= PAYMENT PROOF ================= */}
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

          {/* ================= FOOTER ================= */}
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
  );
};

export default RecordPayment;