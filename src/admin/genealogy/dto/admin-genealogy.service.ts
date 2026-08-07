import { Injectable, NotFoundException } from '@nestjs/common';

import { MemberStatus, MembershipType } from '../../../generated/prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';

import type {
  AdminGenealogyClient,
  AdminGenealogyClientsResponse,
  AdminGenealogyClientStatus,
  AdminGenealogyMembershipType,
  AdminGenealogyTreeResponse,
  AdminNetworkPlacement,
  AdminNetworkTreeNode,
} from './admin-genealogy.types';

/* =========================================================
   CONSTANTS
========================================================= */

const DIRECT_LEFT_LIMIT = 3;

/* =========================================================
   INTERNAL MEMBER RECORD
========================================================= */

interface GenealogyMemberRecord {
  id: string;

  membershipId: string;

  firstName: string;

  middleName: string | null;

  lastName: string;

  username: string;

  membershipType: MembershipType;

  status: MemberStatus;

  referralCode: string;

  sponsorId: string | null;

  memberSince: Date | null;

  createdAt: Date;
}

/* =========================================================
   MEMBER DIRECTORY
========================================================= */

interface GenealogyDirectory {
  members: GenealogyMemberRecord[];

  memberById: Map<string, GenealogyMemberRecord>;

  childrenBySponsorId: Map<string, GenealogyMemberRecord[]>;
}

/* =========================================================
   NETWORK COUNTS
========================================================= */

interface NetworkCounts {
  directReferralCount: number;

  leftNetworkCount: number;

  rightNetworkCount: number;

  totalNetworkCount: number;

  rightBranchUnlocked: boolean;
}

/* =========================================================
   SERVICE
========================================================= */

@Injectable()
export class AdminGenealogyService {
  constructor(private readonly prisma: PrismaService) {}

  /* =======================================================
     CLIENT DIRECTORY
  ======================================================= */

  async getGenealogyClients(): Promise<AdminGenealogyClientsResponse> {
    const directory = await this.loadGenealogyDirectory();

    const clients = directory.members.map((member) =>
      this.createGenealogyClient(member, directory),
    );

    clients.sort((firstClient, secondClient) => {
      if (secondClient.totalNetworkCount !== firstClient.totalNetworkCount) {
        return secondClient.totalNetworkCount - firstClient.totalNetworkCount;
      }

      return firstClient.fullName.localeCompare(
        secondClient.fullName,
        'en-PH',
        {
          sensitivity: 'base',
        },
      );
    });

    return {
      success: true,

      message: 'Genealogy clients retrieved successfully.',

      data: {
        clients,
      },
    };
  }

  /* =======================================================
     MEMBER NETWORK TREE
  ======================================================= */

  async getGenealogyTree(
    memberId: string,
  ): Promise<AdminGenealogyTreeResponse> {
    const normalizedMemberId = memberId.trim();

    if (!normalizedMemberId) {
      throw new NotFoundException('The selected member was not found.');
    }

    const directory = await this.loadGenealogyDirectory();

    const selectedMember = directory.memberById.get(normalizedMemberId);

    if (!selectedMember) {
      throw new NotFoundException(
        'The selected genealogy member was not found.',
      );
    }

    const client = this.createGenealogyClient(selectedMember, directory);

    const root = this.createNetworkTreeNode(
      selectedMember,
      'root',
      null,
      directory,
      new Set<string>(),
    );

    return {
      success: true,

      message: 'Genealogy tree retrieved successfully.',

      data: {
        client,

        root,
      },
    };
  }

  /* =======================================================
     LOAD GENEALOGY DIRECTORY
  ======================================================= */

  private async loadGenealogyDirectory(): Promise<GenealogyDirectory> {
    const members = await this.prisma.member.findMany({
      orderBy: [
        {
          createdAt: 'asc',
        },

        {
          id: 'asc',
        },
      ],

      select: {
        id: true,

        membershipId: true,

        firstName: true,

        middleName: true,

        lastName: true,

        username: true,

        membershipType: true,

        status: true,

        referralCode: true,

        sponsorId: true,

        memberSince: true,

        createdAt: true,
      },
    });

    const memberById = new Map<string, GenealogyMemberRecord>();

    const childrenBySponsorId = new Map<string, GenealogyMemberRecord[]>();

    for (const member of members) {
      memberById.set(member.id, member);

      if (!member.sponsorId) {
        continue;
      }

      const existingChildren = childrenBySponsorId.get(member.sponsorId) ?? [];

      existingChildren.push(member);

      childrenBySponsorId.set(member.sponsorId, existingChildren);
    }

    for (const children of childrenBySponsorId.values()) {
      children.sort((firstMember, secondMember) => {
        const createdDifference =
          firstMember.createdAt.getTime() - secondMember.createdAt.getTime();

        if (createdDifference !== 0) {
          return createdDifference;
        }

        return firstMember.id.localeCompare(secondMember.id);
      });
    }

    return {
      members,

      memberById,

      childrenBySponsorId,
    };
  }

  /* =======================================================
     CREATE CLIENT DTO
  ======================================================= */

  private createGenealogyClient(
    member: GenealogyMemberRecord,
    directory: GenealogyDirectory,
  ): AdminGenealogyClient {
    const sponsor = member.sponsorId
      ? (directory.memberById.get(member.sponsorId) ?? null)
      : null;

    const counts = this.calculateNetworkCounts(member.id, directory);

    return {
      id: member.id,

      membershipId: member.membershipId,

      fullName: this.getFullName(member),

      username: member.username,

      membershipType: this.mapMembershipType(member.membershipType),

      status: this.mapMemberStatus(member.status),

      referralCode: member.referralCode,

      sponsorId: sponsor?.id ?? null,

      sponsorName: sponsor ? this.getFullName(sponsor) : null,

      sponsorMembershipId: sponsor?.membershipId ?? null,

      directReferralCount: counts.directReferralCount,

      leftNetworkCount: counts.leftNetworkCount,

      rightNetworkCount: counts.rightNetworkCount,

      totalNetworkCount: counts.totalNetworkCount,

      rightBranchUnlocked: counts.rightBranchUnlocked,

      joinedAt: (member.memberSince ?? member.createdAt).toISOString(),
    };
  }

  /* =======================================================
     NETWORK COUNTS
  ======================================================= */

  private calculateNetworkCounts(
    memberId: string,
    directory: GenealogyDirectory,
  ): NetworkCounts {
    const directChildren = directory.childrenBySponsorId.get(memberId) ?? [];

    const leftChildren = directChildren.slice(0, DIRECT_LEFT_LIMIT);

    const rightChildren = directChildren.slice(DIRECT_LEFT_LIMIT);

    const leftNetworkCount = leftChildren.reduce(
      (total, child) =>
        total +
        this.countSubtreeMembers(child.id, directory, new Set([memberId])),
      0,
    );

    const rightNetworkCount = rightChildren.reduce(
      (total, child) =>
        total +
        this.countSubtreeMembers(child.id, directory, new Set([memberId])),
      0,
    );

    return {
      directReferralCount: directChildren.length,

      leftNetworkCount,

      rightNetworkCount,

      totalNetworkCount: leftNetworkCount + rightNetworkCount,

      rightBranchUnlocked: leftChildren.length >= DIRECT_LEFT_LIMIT,
    };
  }

  /* =======================================================
     COUNT SUBTREE
  ======================================================= */

  private countSubtreeMembers(
    memberId: string,
    directory: GenealogyDirectory,
    visitedMemberIds: Set<string>,
  ): number {
    if (visitedMemberIds.has(memberId)) {
      return 0;
    }

    const nextVisited = new Set(visitedMemberIds);

    nextVisited.add(memberId);

    const children = directory.childrenBySponsorId.get(memberId) ?? [];

    return (
      1 +
      children.reduce(
        (total, child) =>
          total + this.countSubtreeMembers(child.id, directory, nextVisited),
        0,
      )
    );
  }

  /* =======================================================
     BUILD NETWORK TREE
  ======================================================= */

  private createNetworkTreeNode(
    member: GenealogyMemberRecord,
    placement: AdminNetworkPlacement,
    parentId: string | null,
    directory: GenealogyDirectory,
    visitedMemberIds: Set<string>,
  ): AdminNetworkTreeNode {
    if (visitedMemberIds.has(member.id)) {
      return this.createBaseTreeNode(
        member,
        placement,
        parentId,
        [],
        directory,
      );
    }

    const nextVisited = new Set(visitedMemberIds);

    nextVisited.add(member.id);

    const directChildren = directory.childrenBySponsorId.get(member.id) ?? [];

    const children = directChildren.map((child, index) => {
      const childPlacement: AdminNetworkPlacement =
        index < DIRECT_LEFT_LIMIT ? 'left' : 'right';

      return this.createNetworkTreeNode(
        child,
        childPlacement,
        member.id,
        directory,
        nextVisited,
      );
    });

    return this.createBaseTreeNode(
      member,
      placement,
      parentId,
      children,
      directory,
    );
  }

  /* =======================================================
     CREATE TREE NODE
  ======================================================= */

  private createBaseTreeNode(
    member: GenealogyMemberRecord,
    placement: AdminNetworkPlacement,
    parentId: string | null,
    children: AdminNetworkTreeNode[],
    directory: GenealogyDirectory,
  ): AdminNetworkTreeNode {
    const directReferralCount = (
      directory.childrenBySponsorId.get(member.id) ?? []
    ).length;

    return {
      id: member.id,

      memberId: member.id,

      membershipId: member.membershipId,

      fullName: this.getFullName(member),

      username: member.username,

      membershipType: this.mapMembershipType(member.membershipType),

      status: this.mapMemberStatus(member.status),

      placement,

      verified: member.status === MemberStatus.ACTIVE,

      directReferralCount,

      parentId,

      children,
    };
  }

  /* =======================================================
     FULL NAME
  ======================================================= */

  private getFullName(
    member: Pick<
      GenealogyMemberRecord,
      'firstName' | 'middleName' | 'lastName'
    >,
  ): string {
    return [member.firstName, member.middleName, member.lastName]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .map((value) => value.trim())
      .join(' ');
  }

  /* =======================================================
     MEMBERSHIP MAPPING
  ======================================================= */

  private mapMembershipType(
    membershipType: MembershipType,
  ): AdminGenealogyMembershipType {
    switch (membershipType) {
      case MembershipType.PREMIUM:
        return 'premium';

      case MembershipType.BASIC:
      default:
        return 'basic';
    }
  }

  /* =======================================================
     STATUS MAPPING
  ======================================================= */

  private mapMemberStatus(status: MemberStatus): AdminGenealogyClientStatus {
    switch (status) {
      case MemberStatus.ACTIVE:
        return 'active';

      case MemberStatus.PENDING_ACTIVATION:
        return 'pending';

      case MemberStatus.SUSPENDED:
        return 'suspended';

      case MemberStatus.DISABLED:
      default:
        return 'inactive';
    }
  }
}
