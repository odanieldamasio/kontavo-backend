import { Injectable } from '@nestjs/common';
import { PlanType, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SafeUser } from '../auth/types/safe-user.type';

interface CreateUserInput {
  email: string;
  name: string;
  phone?: string;
  password: string;
  planType?: PlanType;
}

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { id }
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { email }
    });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { phone }
    });
  }

  create(data: CreateUserInput): Promise<User> {
    return this.prismaService.user.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        password: data.password,
        planType: data.planType
      }
    });
  }

  updatePlanType(id: string, planType: PlanType): Promise<User> {
    return this.prismaService.user.update({
      where: { id },
      data: { planType }
    });
  }

  toSafeUser(user: User): SafeUser {
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }
}
