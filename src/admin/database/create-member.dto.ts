const createdMember =
  await this.adminService.createMember({
    firstName: dto.firstName.trim(),

    middleName:
      dto.middleName?.trim() || undefined,

    lastName: dto.lastName.trim(),

    address: dto.address.trim(),

    dateOfBirth: dto.dateOfBirth,

    username:
      dto.username.trim().toLowerCase(),

    email:
      dto.email?.trim().toLowerCase() ||
      undefined,

    phone: dto.phone.trim(),

    password: dto.password,
    confirmPassword: dto.confirmPassword,

    membershipType:
      dto.membershipType ??
      MembershipType.BASIC,

    activationCode:
      dto.activationCode.trim().toUpperCase(),

    sponsorReferralCode:
      sponsor.referralCode,
  });