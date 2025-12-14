const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const API_BASE_URL = (window.APP_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const APPLY_ENDPOINT = `${API_BASE_URL}/api/apply`;

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

    statusEl.textContent = 'Hemos recibido su candidatura con éxito y a la mayor brevedad posible le daremos feedback.';
    applicationForm.reset();
    generateCaptcha();
    updateCvName('Ningún archivo seleccionado');
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

async function submitApplication(formData) {
  console.warn('submitApplication called but API submission is disabled.');
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
