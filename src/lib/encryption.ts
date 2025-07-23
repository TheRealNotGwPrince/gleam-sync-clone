import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'chatvibe-e2e-encryption-key-2024'; // In production, generate per user

export const encryptMessage = (message: string): string => {
  try {
    const encrypted = CryptoJS.AES.encrypt(message, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return message; // Fallback to unencrypted
  }
};

export const decryptMessage = (encryptedMessage: string): string => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    return decrypted || encryptedMessage; // Fallback if decryption fails
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedMessage; // Fallback to showing encrypted text
  }
};

export const generateUserKeys = () => {
  // Generate unique keys per user session
  const timestamp = Date.now().toString();
  const randomBytes = CryptoJS.lib.WordArray.random(32).toString();
  return CryptoJS.SHA256(timestamp + randomBytes).toString();
};