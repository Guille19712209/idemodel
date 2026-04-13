function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);

  const email = data.email;
  console.log("Email:", email);

  validarUsuario(email);
}

function parseJwt(token) {
  return JSON.parse(atob(token.split('.')[1]));
}

function validarUsuario(email) {
  fetch("https://script.google.com/macros/s/AKfycbxPfj8PCVeWCB4c2jNYw-0nO8Ej0Na0BJTjvvma7Nl0_-oehPbirT4BwUM_dx7kpHkaxg/exec", {
    method: "POST",
    body: JSON.stringify({ email })
  })
  .then(res => res.json())
  .then(data => {
    if (data.autorizado) {
      localStorage.setItem("userEmail", email);
      window.location.href = "idemodel.html";
    } else {
      alert("No tenés acceso");
    }
  })
  .catch(err => {
    console.error(err);
    alert("Error validando usuario");
  });
}