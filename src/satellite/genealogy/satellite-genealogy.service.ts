import { Injectable, NotFoundException } from '@nestjs/common';

import { MemberStatus, MembershipType } from '../../generated/prisma/client';

import { PrismaService } from '../../admin/database/prisma/prisma.service';

import type {
  SatelliteGenealogyClient,
  SatelliteGenealogyClientsResponse,
  SatelliteGenealogyClientStatus,
  SatelliteGenealogyMembershipType,
  SatelliteGenealogyTreeResponse,
  SatelliteNetworkPlacement,
  SatelliteNetworkTreeNode,
} from './satellite-genealogy.types';

/*
 * Mirrors AdminGenealogyService's tree-building algorithm, scoped to
 * a single satellite's clients. The client directory only lists
 * members whose satelliteId matches the requesting satellite, but
 * network counts and the drill-down tree are still computed against
 * the FULL member graph -- a client's downline can include members
 * registered under other satellites, and the binary tree structure
 * doesn't stop at satellite boundaries.
 */

const DIRECT_LEFT_LIMIT = 3;

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

  satelliteId: string | null;

  memberSince: Date | null;

  createdAt: Date;
}

interface GenealogyDirectory {
  members: GenealogyMemberRecord[];

  memberById: Map<string, GenealogyMemberRecord>;

  childrenBySponsorId: Map<string, GenealogyMemberRecord[]>;
}

interface NetworkCounts {
  directReferralCount: number;

  leftNetworkCount: number;

  rightNetworkCount: number;

  totalNetworkCount: number;

  rightBranchUnlocked: boolean;
}

@Injectable()
export class SatelliteGenealogyService {
  constructor(private readonly prisma: PrismaService) {}

  /* =======================================================
     CLIENT DIRECTORY
  ======================================================= */

  async getGenealogyClients(
    satelliteId: string,
  ): Promise<SatelliteGenealogyClientsResponse> {
    const directory = await this.loadGenealogyDirectory();

    const clients = directory.members
      .filter((member) => member.satelliteId === satelliteId)
      .map((member) => this.createGenealogyClient(member, directory));

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
    satelliteId: string,
    memberId: string,
  ): Promise<SatelliteGenealogyTreeResponse> {
    const normalizedMemberId = memberId.trim();

    if (!normalizedMemberId) {
      throw new NotFoundException('The selected member was not found.');
    }

    const directory = await this.loadGenealogyDirectory();

    const selectedMember = directory.memberById.get(normalizedMemberId);

    // A satellite may only drill into the network of its own clients,
    // not any arbitrary member id -- treat a member belonging to a
    // different (or no) satellite the same as "not found" rather than
    // leaking whether the id exists at all.
    if (!selectedMember || selectedMember.satelliteId !== satelliteId) {
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

        satelliteId: true,

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
  ): SatelliteGenealogyClient {
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
    placement: SatelliteNetworkPlacement,
    parentId: string | null,
    directory: GenealogyDirectory,
    visitedMemberIds: Set<string>,
  ): SatelliteNetworkTreeNode {
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
      const childPlacement: SatelliteNetworkPlacement =
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
    placement: SatelliteNetworkPlacement,
    parentId: string | null,
    children: SatelliteNetworkTreeNode[],
    directory: GenealogyDirectory,
  ): SatelliteNetworkTreeNode {
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

      rightBranchUnlocked: directReferralCount >= DIRECT_LEFT_LIMIT,

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
  ): SatelliteGenealogyMembershipType {
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

  private mapMemberStatus(
    status: MemberStatus,
  ): SatelliteGenealogyClientStatus {
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
