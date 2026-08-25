import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import RecordPayment from '../components/RecordPayment'

const RecordPaymentPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const student = location.state?.student

  if (!student) {
    return (
      <div>
        <h2>Student not found</h2>

        <button onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    )
  }

  return (
    <RecordPayment
      student={student}
      onClose={() => navigate(-1)}
    />
  )
}

export default RecordPaymentPage