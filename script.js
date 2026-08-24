async function createAdmin() {
  const payload = {
    name: 'Administrador',
    email: 'admin@wol.com',
    password: 'admin123',
    cpf: '00000000000'
  };

  try {
    const res = await fetch('http://localhost:3333/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    console.log('Register response:', result);
  } catch (e) {
    console.error(e);
  }
}
createAdmin();
