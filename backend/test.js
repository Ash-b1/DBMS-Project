const token = sessionStorage.getItem('token');

const response = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/api/admin/doctors`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_name,
      department_name,
      specialization,
      email,
      password
    })
  }
);

const result = await response.json();

if (!response.ok) {
  throw new Error(result.message || 'Failed to register doctor.');
}