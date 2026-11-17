// Ningún campo numérico de la aplicación acepta valores negativos (cantidades, litros,
// temperaturas, pH, envases...). Se aplica una sola vez para TODOS los <input type="number">:
//  - no deja escribir "-", "+" ni "e" (notación científica);
//  - no deja pegar texto con signo negativo;
//  - pone min="0" al enfocar el campo, así las flechas y el mouse no bajan de 0.
const esNumero = (el: EventTarget | null): el is HTMLInputElement =>
  el instanceof HTMLInputElement && el.type === 'number';

export function bloquearNegativos(): void {
  document.addEventListener(
    'keydown',
    (e) => {
      if (!esNumero(e.target)) return;
      if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') e.preventDefault();
    },
    true
  );
  document.addEventListener(
    'paste',
    (e) => {
      if (!esNumero(e.target)) return;
      const texto = e.clipboardData?.getData('text') ?? '';
      if (/[-+eE]/.test(texto)) e.preventDefault();
    },
    true
  );
  document.addEventListener(
    'focusin',
    (e) => {
      if (esNumero(e.target) && !e.target.hasAttribute('min')) e.target.setAttribute('min', '0');
    },
    true
  );
}
