import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';
import { v4 as uuidv4 } from 'uuid';
import type { Request as ExpressRequest } from 'express';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {}

  private parseUserAgent(ua: string): { deviceType: string; deviceName: string } {
    const str = String(ua || '').toLowerCase();

    let deviceType = 'desktop';
    if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(str)) {
      deviceType = 'mobile';
    } else if (/ipad|tablet|kindle|silk/i.test(str)) {
      deviceType = 'tablet';
    }

    let browser = 'Unknown Browser';
    if (str.includes('edg/') || str.includes('edge/')) browser = 'Edge';
    else if (str.includes('opr/') || str.includes('opera')) browser = 'Opera';
    else if (str.includes('chrome')) browser = 'Chrome';
    else if (str.includes('safari') && !str.includes('chrome')) browser = 'Safari';
    else if (str.includes('firefox')) browser = 'Firefox';

    let os = '';
    if (str.includes('windows')) os = 'Windows';
    else if (str.includes('macintosh') || str.includes('mac os x')) os = 'macOS';
    else if (str.includes('android')) os = 'Android';
    else if (str.includes('iphone')) os = 'iPhone';
    else if (str.includes('ipad')) os = 'iPad';
    else if (str.includes('linux')) os = 'Linux';

    const deviceName = os ? `${browser} on ${os}` : browser;
    return { deviceType, deviceName };
  }

  async createSession(
    userId: string,
    request: ExpressRequest,
  ): Promise<string> {
    const tokenId = uuidv4();

    const ua = String(request?.headers?.['user-agent'] || '');
    const { deviceType, deviceName } = this.parseUserAgent(ua);

    const ip =
      (request?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request?.ip ||
      null;

    await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      tokenId,
      deviceType,
      deviceName,
      ipAddress: ip,
      country: null,
      city: null,
      lastUsedAt: new Date(),
    });

    return tokenId;
  }

  async touchSession(tokenId: string): Promise<void> {
    const now = new Date();
    await this.sessionModel.updateOne(
      { tokenId },
      { $set: { lastUsedAt: now } },
    );
  }

  async isSessionValid(tokenId: string): Promise<boolean> {
    const session = await this.sessionModel
      .findOne({ tokenId })
      .select('_id')
      .lean();
    return Boolean(session);
  }

  async getUserSessions(userId: string): Promise<SessionDocument[]> {
    return this.sessionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ lastUsedAt: -1 })
      .lean() as unknown as SessionDocument[];
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.sessionModel.deleteOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount > 0;
  }

  async deleteSessionByTokenId(tokenId: string): Promise<void> {
    await this.sessionModel.deleteOne({ tokenId });
  }

  async deleteAllOtherSessions(currentTokenId: string, userId: string): Promise<number> {
    const result = await this.sessionModel.deleteMany({
      userId: new Types.ObjectId(userId),
      tokenId: { $ne: currentTokenId },
    });
    return result.deletedCount;
  }
}
