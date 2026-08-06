import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../generated/prisma/client', () => ({
  MembershipType: {
    BASIC: 'BASIC',
    PREMIUM: 'PREMIUM',
  },
}));

import { CreateGenealogyMemberDto } from './create-genealogy-member.dto';

describe('CreateGenealogyMemberDto frontend contract', () => {
  it('accepts and transforms the member dashboard payload', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });

    const payload = {
      firstName: 'Juan',
      middleName: 'Reyes',
      lastName: 'Dela Cruz',
      address: '123 Bayanihan Street, Manila',
      dateOfBirth: '1990-01-15',
      username: 'juan.delacruz',
      email: 'juan@example.com',
      phone: '+63 917 123 4567',
      membershipType: 'basic',
      activationCode: 'ACT-123456',
      password: 'safe-password-123',
      referralCode: 'LC-000001',
      memberSince: '2026-08-06',
      sponsorId: '123e4567-e89b-12d3-a456-426614174000',
      placement: 'left',
    };

    const result = (await pipe.transform(payload, {
      type: 'body',
      metatype: CreateGenealogyMemberDto,
    })) as CreateGenealogyMemberDto;

    expect(result).toBeInstanceOf(CreateGenealogyMemberDto);
    expect(result).toEqual({
      ...payload,
      membershipType: 'BASIC',
      placement: 'LEFT',
    });
    expect(result.confirmPassword).toBeUndefined();
  });
});
