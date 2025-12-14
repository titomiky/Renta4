const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 2000;

const applicationForm = document.getElementById('application-form');
const statusEl = document.getElementById('application-status');
const dropArea = document.querySelector('.drop-area');
const cvInput = document.getElementById('cv-input');
const cvNameEl = document.getElementById('cv-name');
const captchaQuestionEl = document.getElementById('captcha-question');
const captchaAnswerInput = document.getElementById('captcha-answer');
const captchaRefreshBtn = document.getElementById('captcha-refresh');
let captchaSolution = null;

if (applicationForm) {
  setupFieldValidation();
  generateCaptcha();

  applicationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!statusEl) return;
    statusEl.textContent = 'Enviando candidatura...';

    if (!validateCaptcha()) {
      statusEl.textContent = 'Resuelve la pregunta de seguridad para continuar.';
      generateCaptcha();
      return;
    }

    const config = await loadSmtpConfig();
    if (!config) {
      statusEl.textContent = 'No podemos enviar tu candidatura en este momento. Inténtalo más tarde.';
      return;
    }

    const formData = new FormData(applicationForm);
    const file = formData.get('cv');
    const validations = validateFields(formData);

    if (!validations.valid) {
      statusEl.textContent = validations.message;
      return;
    }

    if (!file || !file.size) {
      statusEl.textContent = 'Adjunta tu CV en formato PDF.';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      statusEl.textContent = 'El archivo supera los 5 MB permitidos.';
      return;
    }

    if (!(await isValidPdf(file))) {
      statusEl.textContent = 'El archivo no parece un PDF válido.';
      return;
    }

    try {
      await sendApplication(formData, file, config);
      statusEl.textContent = '¡Gracias! Hemos recibido tu candidatura.';
      applicationForm.reset();
      generateCaptcha();
      updateCvName('Ningún archivo seleccionado');
    } catch (error) {
      console.error('Error al enviar candidatura', error);
      statusEl.textContent = 'No pudimos enviar tu candidatura. Inténtalo de nuevo más tarde.';
    }
  });
}

if (dropArea && cvInput) {
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const targets = [dropArea, cvInput];

  targets.forEach((target) => {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      target.addEventListener(eventName, preventDefaults, false);
    });
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
  });

  const handleDrop = (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      processCvFile(file);
    }
  };

  dropArea.addEventListener('drop', handleDrop);
  cvInput.addEventListener('drop', handleDrop);

  cvInput.addEventListener('change', () => {
    const file = cvInput.files[0];
    if (!file) {
      updateCvName('Ningún archivo seleccionado');
      return;
    }
    processCvFile(file, false);
  });
}

function processCvFile(file, setInput = true) {
  if (file.type !== 'application/pdf') {
    updateCvName('Solo se permiten archivos PDF.');
    if (setInput) {
      cvInput.value = '';
    }
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    updateCvName('El archivo supera los 5 MB permitidos.');
    if (setInput) {
      cvInput.value = '';
    }
    return;
  }

  if (setInput) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    cvInput.files = dataTransfer.files;
  }

  updateCvName(file.name);
}

function updateCvName(text) {
  if (cvNameEl) {
    cvNameEl.textContent = text;
  }
}

if (captchaRefreshBtn) {
  captchaRefreshBtn.addEventListener('click', generateCaptcha);
}

function generateCaptcha() {
  if (!captchaQuestionEl || !captchaAnswerInput) return;
  const a = Math.floor(Math.random() * 6) + 2;
  const b = Math.floor(Math.random() * 6) + 2;
  captchaSolution = a + b;
  captchaQuestionEl.textContent = `Control de seguridad: ¿Cuánto es ${a} + ${b}?`;
  captchaAnswerInput.value = '';
}

function validateCaptcha() {
  if (!captchaAnswerInput) return true;
  const userAnswer = parseInt(captchaAnswerInput.value, 10);
  return !Number.isNaN(userAnswer) && userAnswer === captchaSolution;
}

function validateFields(formData) {
  const name = formData.get('name')?.trim() || '';
  const email = formData.get('email')?.trim() || '';
  const phone = formData.get('phone')?.trim() || '';
  const linkedin = formData.get('linkedin')?.trim() || '';
  const message = formData.get('message')?.trim() || '';

  const nameError = getNameError(name);
  if (nameError) return { valid: false, message: nameError };

  const emailError = getEmailError(email);
  if (emailError) return { valid: false, message: emailError };

  const phoneError = getPhoneError(phone);
  if (phoneError) return { valid: false, message: phoneError };

  const linkedinError = getLinkedinError(linkedin);
  if (linkedinError) return { valid: false, message: linkedinError };

  const messageError = getMessageError(message);
  if (messageError) return { valid: false, message: messageError };

  return { valid: true };
}

async function sendApplication(formData, file, emailConfig) {
  if (!window.Email) {
    throw new Error('La librería SMTP no se ha cargado.');
  }

  if (!emailConfig.password || emailConfig.password === 'YOUR_OVH_PASSWORD') {
    throw new Error('Define la contraseña real de la cuenta SMTP antes de enviar.');
  }

  const attachment = await toBase64(file);
  const applicantName = escapeHtml(formData.get('name'));
  const applicantEmail = formData.get('email');
  const body = `
    <p><strong>Nombre:</strong> ${applicantName}</p>
    <p><strong>Email:</strong> ${escapeHtml(formData.get('email'))}</p>
    <p><strong>Teléfono:</strong> ${escapeHtml(formData.get('phone'))}</p>
    <p><strong>LinkedIn:</strong> ${escapeHtml(formData.get('linkedin'))}</p>
    <p><strong>Mensaje:</strong><br/>${sanitizeMessage(formData.get('message'))}</p>
  `;

  const response = await Email.send({
    Host: emailConfig.host,
    Port: emailConfig.port,
    SecureToken: '',
    Username: emailConfig.username,
    Password: emailConfig.password,
    To: emailConfig.to,
    From: emailConfig.username,
    Cc: applicantEmail,
    Subject: `Nueva candidatura: ${applicantName}`,
    Body: body,
    Attachments: [{
      name: file.name,
      data: `data:application/pdf;base64,${attachment}`
    }]
  });

  if (response !== 'OK') {
    throw new Error(response || 'Error SMTP');
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(text = '') {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeMessage(text = '') {
  const clean = escapeHtml(text);
  return clean.replace(/\r?\n/g, '<br/>');
}

async function isValidPdf(file) {
  try {
    const arrayBuffer = await file.slice(0, 5).arrayBuffer();
    const header = new Uint8Array(arrayBuffer);
    const signature = String.fromCharCode(...header);
    return signature.startsWith('%PDF');
  } catch (error) {
    console.error('Error validando PDF', error);
    return false;
  }
}

function setupFieldValidation() {
  const validators = {
    name: getNameError,
    email: getEmailError,
    phone: getPhoneError,
    linkedin: getLinkedinError,
    message: getMessageError
  };

  Object.entries(validators).forEach(([fieldName, validator]) => {
    const field = applicationForm.querySelector(`[name="${fieldName}"]`);
    if (!field) return;
    field.addEventListener('blur', () => {
      const error = validator(field.value.trim());
      field.setCustomValidity(error || '');
      if (error) field.reportValidity();
    });
    field.addEventListener('input', () => {
      field.setCustomValidity('');
    });
  });
}

function getNameError(value = '') {
  if (!/^[A-Za-zÀ-ÿ'´`ñÑ\-.\s]{3,80}$/.test(value)) {
    return 'Introduce un nombre válido (solo letras y espacios).';
  }
  return '';
}

function getEmailError(value = '') {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Introduce un email válido.';
  }
  return '';
}

function getPhoneError(value = '') {
  if (!/^[+]?[-\d\s().]{7,20}$/.test(value)) {
    return 'Introduce un teléfono válido.';
  }
  return '';
}

function getLinkedinError(value = '') {
  try {
    const url = new URL(value);
    if (!url.hostname.includes('linkedin.com')) {
      return 'Introduce un enlace de LinkedIn válido.';
    }
  } catch (error) {
    return 'Introduce un enlace de LinkedIn válido.';
  }
  return '';
}

function getMessageError(value = '') {
  if (value.length < 20 || value.length > MAX_MESSAGE_LENGTH) {
    return 'El mensaje debe tener entre 20 y 2000 caracteres.';
  }
  if (/<script|<\/|onerror=|onload=/i.test(value)) {
    return 'El mensaje contiene contenido no permitido.';
  }
  return '';
}
