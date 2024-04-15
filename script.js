document.addEventListener("DOMContentLoaded", async function () {
  document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const email = formData.get("email");
    const password = formData.get("password");

    if (!email || !password) {
      alert("Both email and password are required");
      return;
    }

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString(),
      });

      const data = await response.text();

      if (data.includes('Login successful')) {
        const message = 'Login successful';
        const redirectUrl = '/index2.html';
        showAlert(message, redirectUrl);

        // Add a delay or use await before calling updateProfileInfo
        setTimeout(updateProfileInfo, 500); // Adjust the delay as needed
      } else {
        const message = 'Invalid credentials';
        showAlert(message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  });

  document.getElementById("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (password !== confirmPassword) {
      alert("Password and Confirm Password do not match");
      return;
    }

    try {
      const response = await fetch('/register', {
        method: 'POST',
        body: formData,
      });

      const data = await response.text();

      if (data.includes('Registration successful')) {
        const message = 'Registration successful. Click OK to proceed to login.';
        const redirectUrl = '/';
        showAlert(message, redirectUrl);

        // Add a delay or use await before calling updateProfileInfo
        setTimeout(updateProfileInfo, 500); // Adjust the delay as needed
      } else {
        showAlert(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  });

  function showAlert(message, redirectUrl) {
    alert(`${message}. Click OK to proceed.`);
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }

});
