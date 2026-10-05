"use server";
import {
  requestPasswordReset,
  signInWithPassword,
  updatePassword,
  type FormState,
} from "@hagap/core/auth";

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  return signInWithPassword(formData);
}

export async function resetRequestAction(_state: FormState, formData: FormData): Promise<FormState> {
  return requestPasswordReset(formData);
}

export async function updatePasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  return updatePassword(formData);
}
