/** Form validation. Messages are i18n keys, translated at display time. */
import { z } from 'zod';

const email = z
  .string()
  .trim()
  .min(1, 'auth.errors.emailRequired')
  .email('auth.errors.emailInvalid');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'auth.errors.passwordRequired'),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'auth.errors.firstNameRequired').max(60),
  email,
  password: z.string().min(10, 'auth.errors.passwordTooShort'),
  // The app is for adults (18+ content, App Store age rating): confirmed, not assumed.
  isAdult: z.boolean().refine((value) => value, 'auth.errors.adultRequired'),
});

export const forgotPasswordSchema = z.object({ email });

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
