import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import {
  Prisma,
  SatelliteAccountRole,
  SatelliteAccountStatus,
  SatelliteBusinessType,
  SatelliteCivilStatus,
  SatelliteGender,
  SatelliteLevel,
  SatelliteStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma/prisma.service';
import { AdminSatellitesQueryDto } from './dto/admin-satellites-query.dto';
import { CreateAdminSatelliteDto } from './dto/create-admin-satellite.dto';
import { ResetSatellitePasswordDto } from './dto/reset-satellite-password.dto';
import { UpdateAdminSatelliteStatusDto } from './dto/update-admin-satellite-status.dto';
import { UpdateAdminSatelliteDto } from './dto/update-admin-satellite.dto';

const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RANDOM_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 10;

const SATELLITE_INCLUDE = {
  manager: true,
  payoutAccount: true,
  account: true,
  permissions: true,
  _count: {
    select: {
      members: true,
    },
  },
} satisfies Prisma.SatelliteInclude;

type SatelliteRecord = Prisma.SatelliteGetPayload<{
  include: typeof SATELLITE_INCLUDE;
}>;

export interface AdminIdentity {
  id: string | null;
  name: string | null;
}

export interface AdminSatelliteApiResponse {
  id: string;
  satelliteCode: string;
  satelliteName: string;
  status: 'pending' | 'active' | 'suspended' | 'inactive' | 'closed';
  businessType: 'franchise' | 'company-owned' | 'affiliate';
  memberCount: number;
  manager: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
    fullName: string;
    gender: 'male' | 'female' | 'prefer-not-to-say' | null;
    civilStatus: 'single' | 'married' | 'widowed' | 'separated';
    birthDate: string | null;
    nationality: string;
    contactNumber: string;
    alternateContactNumber: string | null;
    email: string;
  };
  location: {
    region: string;
    province: string;
    city: string;
    barangay: string;
    streetAddress: string;
    zipCode: string | null;
    completeAddress: string;
  };
  operation: {
    satelliteLevel: 'regional' | 'provincial' | 'city' | 'barangay';
    coverageArea: string;
    operatingHours: string;
    openingDate: string | null;
    maximumMembers: number;
    commissionPercentage: number;
    remarks: string | null;
  };
  payoutAccount: {
    gcashNumber: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
  };
  governmentIdentification: {
    validIdType: string | null;
    validIdNumber: string | null;
    taxIdentificationNumber: string | null;
  };
  account: {
    username: string;
    role: 'satellite-admin' | 'manager';
  };
  permissions: {
    canRegisterMembers: boolean;
    canActivateMembers: boolean;
    canProcessClaims: boolean;
    canViewGenealogy: boolean;
    canManageBeneficiaries: boolean;
    canViewTransactions: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdminSatellitePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AdminSatelliteListResponse {
  satellites: AdminSatelliteApiResponse[];
  pagination: AdminSatellitePagination;
}

export interface AdminSatelliteOverviewResponse {
  totalSatellites: number;
  activeSatellites: number;
  pendingSatellites: number;
  suspendedSatellites: number;
  inactiveSatellites: number;
  closedSatellites: number;
  totalMembers: number;
}

export interface CreateAdminSatelliteResponse {
  message: string;
  satellite: AdminSatelliteApiResponse;
}

export interface AdminSatelliteStatusHistoryResponse {
  history: Array<{
    id: string;
    satelliteId: string;
    previousStatus: 'pending' | 'active' | 'suspended' | 'inactive' | 'closed';
    newStatus: 'pending' | 'active' | 'suspended' | 'inactive' | 'closed';
    reason: string | null;
    changedBy: {
      id: string;
      fullName: string;
      email: null;
    } | null;
    createdAt: string;
  }>;
}

export interface SatelliteMessageResponse {
  message: string;
}

@Injectable()
export class AdminSatellitesService {
  constructor(private readonly prisma: PrismaService) {}

  async getSatellites(
    query: AdminSatellitesQueryDto,
  ): Promise<AdminSatelliteListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);

    const [total, satellites] = await this.prisma.$transaction([
      this.prisma.satellite.count({ where }),
      this.prisma.satellite.findMany({
        where,
        include: SATELLITE_INCLUDE,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      satellites: satellites.map((satellite) => mapSatellite(satellite)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getOverview(): Promise<AdminSatelliteOverviewResponse> {
    const [
      totalSatellites,
      activeSatellites,
      pendingSatellites,
      suspendedSatellites,
      inactiveSatellites,
      closedSatellites,
      totalMembers,
    ] = await this.prisma.$transaction([
      this.prisma.satellite.count(),
      this.prisma.satellite.count({
        where: {
          status: SatelliteStatus.ACTIVE,
        },
      }),
      this.prisma.satellite.count({
        where: {
          status: SatelliteStatus.PENDING,
        },
      }),
      this.prisma.satellite.count({
        where: {
          status: SatelliteStatus.SUSPENDED,
        },
      }),
      this.prisma.satellite.count({
        where: {
          status: SatelliteStatus.INACTIVE,
        },
      }),
      this.prisma.satellite.count({
        where: {
          status: SatelliteStatus.CLOSED,
        },
      }),
      this.prisma.member.count({
        where: {
          satelliteId: {
            not: null,
          },
        },
      }),
    ]);

    return {
      totalSatellites,
      activeSatellites,
      pendingSatellites,
      suspendedSatellites,
      inactiveSatellites,
      closedSatellites,
      totalMembers,
    };
  }

  async getSatelliteById(
    satelliteId: string,
  ): Promise<AdminSatelliteApiResponse> {
    const satellite = await this.prisma.satellite.findUnique({
      where: {
        id: satelliteId,
      },
      include: SATELLITE_INCLUDE,
    });

    if (!satellite) {
      throw new NotFoundException('Satellite office was not found.');
    }

    return mapSatellite(satellite);
  }

  async createSatellite(
    dto: CreateAdminSatelliteDto,
  ): Promise<CreateAdminSatelliteResponse> {
    if (dto.account.password !== dto.account.confirmPassword) {
      throw new BadRequestException({
        message: 'The passwords do not match.',
        errors: {
          confirmPassword: ['The password confirmation does not match.'],
        },
      });
    }

    const satelliteCode = await this.generateUniqueSatelliteCode(
      dto.location.province,
      dto.location.city,
    );

    const passwordHash = await argon2.hash(dto.account.password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    try {
      const satellite = await this.prisma.satellite.create({
        data: {
          satelliteCode,
          satelliteName: dto.satelliteName,
          businessType: dto.businessType,
          level: dto.satelliteLevel,
          status: SatelliteStatus.PENDING,
          region: dto.location.region,
          province: dto.location.province,
          city: dto.location.city,
          barangay: dto.location.barangay,
          streetAddress: dto.location.streetAddress,
          zipCode: dto.location.zipCode ?? null,
          openingDate: toDateOnly(dto.operation.openingDate),
          coverageArea: dto.operation.coverageArea,
          operatingHours: dto.operation.operatingHours,
          maximumMembers: dto.operation.maximumMembers,
          commissionPercentage: dto.operation.commissionPercentage,
          remarks: dto.operation.remarks ?? null,
          manager: {
            create: {
              firstName: dto.manager.firstName,
              middleName: dto.manager.middleName ?? null,
              lastName: dto.manager.lastName,
              suffix: dto.manager.suffix ?? null,
              birthDate: toDateOnly(dto.manager.birthDate),
              gender: dto.manager.gender ?? null,
              civilStatus: dto.manager.civilStatus,
              nationality: dto.manager.nationality,
              contactNumber: dto.manager.contactNumber,
              alternateContactNumber:
                dto.manager.alternateContactNumber ?? null,
              email: dto.manager.email,
              validIdType: dto.governmentIdentification.validIdType ?? null,
              validIdNumber: dto.governmentIdentification.validIdNumber ?? null,
              taxIdentificationNumber:
                dto.governmentIdentification.taxIdentificationNumber ?? null,
            },
          },
          payoutAccount: {
            create: {
              gcashNumber: dto.payoutAccount.gcashNumber ?? null,
              bankName: dto.payoutAccount.bankName ?? null,
              bankAccountName: dto.payoutAccount.bankAccountName ?? null,
              bankAccountNumber: dto.payoutAccount.bankAccountNumber ?? null,
            },
          },
          account: {
            create: {
              username: dto.account.username,
              passwordHash,
              role: SatelliteAccountRole.SATELLITE_ADMIN,
              status: SatelliteAccountStatus.DISABLED,
              mustChangePassword: true,
            },
          },
          permissions: {
            create: {
              canRegisterMembers: dto.permissions.canRegisterMembers,
              canActivateMembers: dto.permissions.canActivateMembers,
              canProcessClaims: dto.permissions.canProcessClaims,
              canViewGenealogy: dto.permissions.canViewGenealogy,
              canManageBeneficiaries: dto.permissions.canManageBeneficiaries,
              canViewTransactions: dto.permissions.canViewTransactions,
            },
          },
        },
        include: SATELLITE_INCLUDE,
      });

      return {
        message:
          'Satellite office created successfully and is pending approval.',
        satellite: mapSatellite(satellite),
      };
    } catch (error: unknown) {
      this.throwKnownDatabaseError(error);
    }
  }

  async updateSatellite(
    satelliteId: string,
    dto: UpdateAdminSatelliteDto,
  ): Promise<AdminSatelliteApiResponse> {
    await this.ensureSatelliteExists(satelliteId);

    const managerUpdate = {
      ...(dto.manager?.firstName !== undefined && {
        firstName: dto.manager.firstName,
      }),
      ...(dto.manager?.middleName !== undefined && {
        middleName: dto.manager.middleName,
      }),
      ...(dto.manager?.lastName !== undefined && {
        lastName: dto.manager.lastName,
      }),
      ...(dto.manager?.suffix !== undefined && {
        suffix: dto.manager.suffix,
      }),
      ...(dto.manager?.birthDate !== undefined && {
        birthDate: toDateOnly(dto.manager.birthDate),
      }),
      ...(dto.manager?.gender !== undefined && {
        gender: dto.manager.gender,
      }),
      ...(dto.manager?.civilStatus !== undefined && {
        civilStatus: dto.manager.civilStatus,
      }),
      ...(dto.manager?.nationality !== undefined && {
        nationality: dto.manager.nationality,
      }),
      ...(dto.manager?.contactNumber !== undefined && {
        contactNumber: dto.manager.contactNumber,
      }),
      ...(dto.manager?.alternateContactNumber !== undefined && {
        alternateContactNumber: dto.manager.alternateContactNumber,
      }),
      ...(dto.manager?.email !== undefined && {
        email: dto.manager.email,
      }),
      ...(dto.governmentIdentification?.validIdType !== undefined && {
        validIdType: dto.governmentIdentification.validIdType,
      }),
      ...(dto.governmentIdentification?.validIdNumber !== undefined && {
        validIdNumber: dto.governmentIdentification.validIdNumber,
      }),
      ...(dto.governmentIdentification?.taxIdentificationNumber !==
        undefined && {
        taxIdentificationNumber:
          dto.governmentIdentification.taxIdentificationNumber,
      }),
    };

    try {
      const satellite = await this.prisma.satellite.update({
        where: {
          id: satelliteId,
        },
        data: {
          ...(dto.satelliteName !== undefined && {
            satelliteName: dto.satelliteName,
          }),
          ...(dto.businessType !== undefined && {
            businessType: dto.businessType,
          }),
          ...(dto.satelliteLevel !== undefined && {
            level: dto.satelliteLevel,
          }),
          ...(dto.location?.region !== undefined && {
            region: dto.location.region,
          }),
          ...(dto.location?.province !== undefined && {
            province: dto.location.province,
          }),
          ...(dto.location?.city !== undefined && {
            city: dto.location.city,
          }),
          ...(dto.location?.barangay !== undefined && {
            barangay: dto.location.barangay,
          }),
          ...(dto.location?.streetAddress !== undefined && {
            streetAddress: dto.location.streetAddress,
          }),
          ...(dto.location?.zipCode !== undefined && {
            zipCode: dto.location.zipCode,
          }),
          ...(dto.operation?.openingDate !== undefined && {
            openingDate: toDateOnly(dto.operation.openingDate),
          }),
          ...(dto.operation?.coverageArea !== undefined && {
            coverageArea: dto.operation.coverageArea,
          }),
          ...(dto.operation?.operatingHours !== undefined && {
            operatingHours: dto.operation.operatingHours,
          }),
          ...(dto.operation?.maximumMembers !== undefined && {
            maximumMembers: dto.operation.maximumMembers,
          }),
          ...(dto.operation?.commissionPercentage !== undefined && {
            commissionPercentage: dto.operation.commissionPercentage,
          }),
          ...(dto.operation?.remarks !== undefined && {
            remarks: dto.operation.remarks,
          }),
          ...(Object.keys(managerUpdate).length > 0 && {
            manager: {
              update: managerUpdate,
            },
          }),
          ...(dto.payoutAccount && {
            payoutAccount: {
              update: {
                ...(dto.payoutAccount.gcashNumber !== undefined && {
                  gcashNumber: dto.payoutAccount.gcashNumber,
                }),
                ...(dto.payoutAccount.bankName !== undefined && {
                  bankName: dto.payoutAccount.bankName,
                }),
                ...(dto.payoutAccount.bankAccountName !== undefined && {
                  bankAccountName: dto.payoutAccount.bankAccountName,
                }),
                ...(dto.payoutAccount.bankAccountNumber !== undefined && {
                  bankAccountNumber: dto.payoutAccount.bankAccountNumber,
                }),
              },
            },
          }),
          ...(dto.account && {
            account: {
              update: {
                ...(dto.account.username !== undefined && {
                  username: dto.account.username,
                }),
                ...(dto.account.role !== undefined && {
                  role: dto.account.role,
                }),
              },
            },
          }),
          ...(dto.permissions && {
            permissions: {
              update: {
                ...dto.permissions,
              },
            },
          }),
        },
        include: SATELLITE_INCLUDE,
      });

      return mapSatellite(satellite);
    } catch (error: unknown) {
      this.throwKnownDatabaseError(error);
    }
  }

  async updateSatelliteStatus(
    satelliteId: string,
    dto: UpdateAdminSatelliteStatusDto,
    admin: AdminIdentity,
  ): Promise<AdminSatelliteApiResponse> {
    if (
      requiresStatusReason(dto.status) &&
      (!dto.reason || dto.reason.trim().length < 5)
    ) {
      throw new BadRequestException({
        message: 'A clear reason is required for this status.',
        errors: {
          reason: ['The reason must contain at least 5 characters.'],
        },
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.satellite.findUnique({
        where: {
          id: satelliteId,
        },
      });

      if (!current) {
        throw new NotFoundException('Satellite office was not found.');
      }

      if (current.status === dto.status) {
        throw new ConflictException(
          `The satellite is already ${toApiStatus(dto.status)}.`,
        );
      }

      const accountStatus =
        dto.status === SatelliteStatus.ACTIVE
          ? SatelliteAccountStatus.ACTIVE
          : SatelliteAccountStatus.DISABLED;

      const satellite = await transaction.satellite.update({
        where: {
          id: satelliteId,
        },
        data: {
          status: dto.status,
          account: {
            update: {
              status: accountStatus,
            },
          },
        },
        include: SATELLITE_INCLUDE,
      });

      await transaction.satelliteStatusHistory.create({
        data: {
          satelliteId,
          previousStatus: current.status,
          newStatus: dto.status,
          reason: dto.reason ?? null,
          changedByAdminId: admin.id,
          changedByAdminName: admin.name,
        },
      });

      return mapSatellite(satellite);
    });
  }

  async getStatusHistory(
    satelliteId: string,
  ): Promise<AdminSatelliteStatusHistoryResponse> {
    await this.ensureSatelliteExists(satelliteId);

    const history = await this.prisma.satelliteStatusHistory.findMany({
      where: {
        satelliteId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return {
      history: history.map((entry) => ({
        id: entry.id,
        satelliteId: entry.satelliteId,
        previousStatus: toApiStatus(entry.previousStatus),
        newStatus: toApiStatus(entry.newStatus),
        reason: entry.reason,
        changedBy:
          entry.changedByAdminId || entry.changedByAdminName
            ? {
                id: entry.changedByAdminId ?? 'admin',
                fullName: entry.changedByAdminName ?? 'Administrator',
                email: null,
              }
            : null,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  async resetPassword(
    satelliteId: string,
    dto: ResetSatellitePasswordDto,
  ): Promise<SatelliteMessageResponse> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException({
        message: 'The passwords do not match.',
        errors: {
          confirmPassword: ['The password confirmation does not match.'],
        },
      });
    }

    await this.ensureSatelliteExists(satelliteId);

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    await this.prisma.satelliteAccount.update({
      where: {
        satelliteId,
      },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordChangedAt: null,
      },
    });

    return {
      message: 'Satellite administrator password reset successfully.',
    };
  }

  async deleteSatellite(
    satelliteId: string,
  ): Promise<SatelliteMessageResponse> {
    const satellite = await this.prisma.satellite.findUnique({
      where: {
        id: satelliteId,
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!satellite) {
      throw new NotFoundException('Satellite office was not found.');
    }

    if (satellite.status === SatelliteStatus.ACTIVE) {
      throw new ConflictException(
        'An active satellite cannot be deleted. Change its status first.',
      );
    }

    if (satellite._count.members > 0) {
      throw new ConflictException(
        'This satellite still has assigned members and cannot be deleted.',
      );
    }

    await this.prisma.satellite.delete({
      where: {
        id: satelliteId,
      },
    });

    return {
      message: 'Satellite office deleted successfully.',
    };
  }

  private buildWhere(
    query: AdminSatellitesQueryDto,
  ): Prisma.SatelliteWhereInput {
    return {
      ...(query.status && {
        status: query.status,
      }),
      ...(query.businessType && {
        businessType: query.businessType,
      }),
      ...(query.region && {
        region: {
          contains: query.region,
        },
      }),
      ...(query.province && {
        province: {
          contains: query.province,
        },
      }),
      ...(query.city && {
        city: {
          contains: query.city,
        },
      }),
      ...(query.search && {
        OR: [
          {
            satelliteCode: {
              contains: query.search,
            },
          },
          {
            satelliteName: {
              contains: query.search,
            },
          },
          {
            region: {
              contains: query.search,
            },
          },
          {
            province: {
              contains: query.search,
            },
          },
          {
            city: {
              contains: query.search,
            },
          },
          {
            manager: {
              is: {
                OR: [
                  {
                    firstName: {
                      contains: query.search,
                    },
                  },
                  {
                    lastName: {
                      contains: query.search,
                    },
                  },
                  {
                    email: {
                      contains: query.search,
                    },
                  },
                ],
              },
            },
          },
        ],
      }),
    };
  }

  private buildOrderBy(
    query: AdminSatellitesQueryDto,
  ): Prisma.SatelliteOrderByWithRelationInput {
    const direction = query.sortOrder ?? 'desc';

    switch (query.sortBy) {
      case 'satelliteName':
        return { satelliteName: direction };
      case 'satelliteCode':
        return { satelliteCode: direction };
      case 'status':
        return { status: direction };
      case 'memberCount':
        return {
          members: {
            _count: direction,
          },
        };
      case 'updatedAt':
        return { updatedAt: direction };
      case 'createdAt':
      default:
        return { createdAt: direction };
    }
  }

  private async ensureSatelliteExists(satelliteId: string): Promise<void> {
    const satellite = await this.prisma.satellite.findUnique({
      where: {
        id: satelliteId,
      },
      select: {
        id: true,
      },
    });

    if (!satellite) {
      throw new NotFoundException('Satellite office was not found.');
    }
  }

  private async generateUniqueSatelliteCode(
    province: string,
    city: string,
  ): Promise<string> {
    const locationCode = `${toCodePart(province)}${toCodePart(city)}`;

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      let suffix = '';

      for (let index = 0; index < CODE_RANDOM_LENGTH; index += 1) {
        suffix += CODE_CHARACTERS[randomInt(CODE_CHARACTERS.length)];
      }

      const code = `SAT-${locationCode}-${suffix}`;

      const existing = await this.prisma.satellite.findUnique({
        where: {
          satelliteCode: code,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return code;
      }
    }

    throw new InternalServerErrorException(
      'Unable to generate a unique satellite code. Please try again.',
    );
  }

  private throwKnownDatabaseError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A satellite with the same username, manager email, contact number, identification number, or tax number already exists.',
      );
    }

    throw error;
  }
}

function mapSatellite(satellite: SatelliteRecord): AdminSatelliteApiResponse {
  if (
    !satellite.manager ||
    !satellite.payoutAccount ||
    !satellite.account ||
    !satellite.permissions
  ) {
    throw new InternalServerErrorException(
      'The satellite record is incomplete.',
    );
  }

  const manager = satellite.manager;

  const fullName = [
    manager.firstName,
    manager.middleName,
    manager.lastName,
    manager.suffix,
  ]
    .filter(Boolean)
    .join(' ');

  const completeAddress = [
    satellite.streetAddress,
    satellite.barangay,
    satellite.city,
    satellite.province,
    satellite.region,
    satellite.zipCode,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    id: satellite.id,
    satelliteCode: satellite.satelliteCode,
    satelliteName: satellite.satelliteName,
    status: toApiStatus(satellite.status),
    businessType: toApiBusinessType(satellite.businessType),
    memberCount: satellite._count.members,
    manager: {
      firstName: manager.firstName,
      middleName: manager.middleName,
      lastName: manager.lastName,
      suffix: manager.suffix,
      fullName,
      gender: manager.gender ? toApiGender(manager.gender) : null,
      civilStatus: toApiCivilStatus(manager.civilStatus),
      birthDate: manager.birthDate ? formatDateOnly(manager.birthDate) : null,
      nationality: manager.nationality,
      contactNumber: manager.contactNumber,
      alternateContactNumber: manager.alternateContactNumber,
      email: manager.email,
    },
    location: {
      region: satellite.region,
      province: satellite.province,
      city: satellite.city,
      barangay: satellite.barangay,
      streetAddress: satellite.streetAddress,
      zipCode: satellite.zipCode,
      completeAddress,
    },
    operation: {
      satelliteLevel: toApiLevel(satellite.level),
      coverageArea: satellite.coverageArea,
      operatingHours: satellite.operatingHours,
      openingDate: satellite.openingDate
        ? formatDateOnly(satellite.openingDate)
        : null,
      maximumMembers: satellite.maximumMembers,
      commissionPercentage: Number(satellite.commissionPercentage),
      remarks: satellite.remarks,
    },
    payoutAccount: {
      gcashNumber: satellite.payoutAccount.gcashNumber,
      bankName: satellite.payoutAccount.bankName,
      bankAccountName: satellite.payoutAccount.bankAccountName,
      bankAccountNumber: satellite.payoutAccount.bankAccountNumber,
    },
    governmentIdentification: {
      validIdType: manager.validIdType,
      validIdNumber: manager.validIdNumber,
      taxIdentificationNumber: manager.taxIdentificationNumber,
    },
    account: {
      username: satellite.account.username,
      role:
        satellite.account.role === SatelliteAccountRole.MANAGER
          ? 'manager'
          : 'satellite-admin',
    },
    permissions: {
      canRegisterMembers: satellite.permissions.canRegisterMembers,
      canActivateMembers: satellite.permissions.canActivateMembers,
      canProcessClaims: satellite.permissions.canProcessClaims,
      canViewGenealogy: satellite.permissions.canViewGenealogy,
      canManageBeneficiaries: satellite.permissions.canManageBeneficiaries,
      canViewTransactions: satellite.permissions.canViewTransactions,
    },
    createdAt: satellite.createdAt.toISOString(),
    updatedAt: satellite.updatedAt.toISOString(),
  };
}

function toApiStatus(
  status: SatelliteStatus,
): 'pending' | 'active' | 'suspended' | 'inactive' | 'closed' {
  return status.toLowerCase() as
    'pending' | 'active' | 'suspended' | 'inactive' | 'closed';
}

function toApiBusinessType(
  type: SatelliteBusinessType,
): 'franchise' | 'company-owned' | 'affiliate' {
  return type === SatelliteBusinessType.COMPANY_OWNED
    ? 'company-owned'
    : (type.toLowerCase() as 'franchise' | 'affiliate');
}

function toApiLevel(
  level: SatelliteLevel,
): 'regional' | 'provincial' | 'city' | 'barangay' {
  return level.toLowerCase() as 'regional' | 'provincial' | 'city' | 'barangay';
}

function toApiGender(
  gender: SatelliteGender,
): 'male' | 'female' | 'prefer-not-to-say' {
  return gender === SatelliteGender.PREFER_NOT_TO_SAY
    ? 'prefer-not-to-say'
    : (gender.toLowerCase() as 'male' | 'female');
}

function toApiCivilStatus(
  status: SatelliteCivilStatus,
): 'single' | 'married' | 'widowed' | 'separated' {
  return status.toLowerCase() as 'single' | 'married' | 'widowed' | 'separated';
}

function requiresStatusReason(status: SatelliteStatus): boolean {
  return (
    status === SatelliteStatus.SUSPENDED ||
    status === SatelliteStatus.INACTIVE ||
    status === SatelliteStatus.CLOSED
  );
}

function toDateOnly(value?: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toCodePart(value: string): string {
  const normalized = value.replace(/[^a-zA-Z]/g, '').toUpperCase();

  return normalized.slice(0, 3).padEnd(3, 'X');
}
