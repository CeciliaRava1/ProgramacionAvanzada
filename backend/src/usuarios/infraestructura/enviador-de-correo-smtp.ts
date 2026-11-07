import nodemailer from 'nodemailer';
import { EnviadorDeCorreo, type CorreoSaliente } from '../dominio/recuperacion-de-contrasena.js';

/** Envío por SMTP. En desarrollo apunta a Mailpit, que no entrega los correos: los muestra en una bandeja local. */
export class EnviadorDeCorreoSmtp extends EnviadorDeCorreo {
  private readonly transporte;

  // shortcut: sin usuario ni contraseña SMTP; al usar un proveedor real hay que agregarlos.
  constructor(host: string, puerto: number, private readonly remitente: string) {
    super();
    this.transporte = nodemailer.createTransport({ host, port: puerto, secure: false, ignoreTLS: true });
  }

  async enviar(correo: CorreoSaliente): Promise<void> {
    await this.transporte.sendMail({ from: this.remitente, to: correo.para, subject: correo.asunto, text: correo.texto });
  }
}
