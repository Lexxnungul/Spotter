declare module 'qrcode' {
  interface QRCodeOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    width?: number;
    type?: string;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  interface QRCodeStatic {
    toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  }

  const QRCode: QRCodeStatic;
  export default QRCode;
}
