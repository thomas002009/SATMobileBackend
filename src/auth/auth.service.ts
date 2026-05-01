import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.emailVerified) {
        if (!existing.password) throw new UnauthorizedException('Please sign in with Google');
        const valid = await bcrypt.compare(password, existing.password);
        if (!valid) throw new UnauthorizedException('Invalid credentials');
        return { access_token: this.jwt.sign({ sub: existing.id }) };
      }
      throw new ConflictException('Email already in use but not verified — check your inbox');
    }

    const hash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await this.prisma.user.create({
      data: { email, password: hash, verificationToken },
    });

    const url = `${process.env.APP_URL}/auth/verify-email?token=${verificationToken}`;
    await this.mailer.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Confirm your email',
      html: `<p>Click to verify your account: <a href="${url}">${url}</a></p>`,
    });

    return { message: 'Check your email to verify your account.' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({ where: { verificationToken: token } });
    if (!user) throw new BadRequestException('Invalid or expired token');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null },
    });

    return { access_token: this.jwt.sign({ sub: user.id }) };
  }

  async googleLogin(googleId: string, email: string) {
    let user = await this.prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId, emailVerified: true },
        });
      } else {
        user = await this.prisma.user.create({
          data: { email, googleId, emailVerified: true },
        });
      }
    }

    return { access_token: this.jwt.sign({ sub: user.id }) };
  }

  async deleteAccount(userId: string) {
    await this.prisma.$transaction([
      this.prisma.userWordProgress.deleteMany({ where: { userId } }),
      this.prisma.wordList.updateMany({ where: { ownerId: userId }, data: { ownerId: null } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { message: 'Account deleted.' };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.password) throw new UnauthorizedException('Please sign in with Google');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerified) throw new UnauthorizedException('Please verify your email first');

    return { access_token: this.jwt.sign({ sub: user.id }) };
  }
}
