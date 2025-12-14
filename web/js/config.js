async function loadSmtpConfig() {
  try {
    const response = await fetch('config/smtp-config.json');
    if (!response.ok) {
      throw new Error('No se pudo cargar la configuración SMTP');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error cargando configuración SMTP', error);
    return null;
  }
}
