import { prisma } from './prisma';
import { mobilePhoneSchema } from './phone';
import { signupTypeSchema } from './auth-validation';

// This record is written only by the signup server action. Editable Auth metadata never grants a role.
export async function rememberRegistration(
  userId: string,
  email: string,
  role: 'CUSTOMER' | 'TECHNICIAN',
  phone: string,
) {
  await prisma.registrationIntent.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      role: signupTypeSchema.parse(role),
      phone: mobilePhoneSchema.parse(phone),
    },
    update: {},
  });
}
