// Declaración mínima: solo lo que usa el enviador SMTP, para no sumar paquetes de tipos con dependencias de nube.
declare module 'nodemailer' {
  interface OpcionesDeTransporte { host: string; port: number; secure?: boolean; ignoreTLS?: boolean }
  interface Mensaje { from: string; to: string; subject: string; text: string }
  interface Transporte { sendMail(mensaje: Mensaje): Promise<unknown> }
  const nodemailer: { createTransport(opciones: OpcionesDeTransporte): Transporte };
  export default nodemailer;
}
