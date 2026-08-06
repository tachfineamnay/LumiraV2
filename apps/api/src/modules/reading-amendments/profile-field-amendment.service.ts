import { Injectable } from '@nestjs/common';
import { Expert } from '@prisma/client';
import {
  CreateProfileFieldAmendmentDto,
  ReviewProfileFieldAmendmentDto,
  SaveProfileFieldAmendmentDraftDto,
  SubmitProfileFieldAmendmentDto,
} from './dto/profile-field-amendment.dto';
import { ProfileFieldAmendmentClientService } from './profile-field-amendment-client.service';
import { ProfileFieldAmendmentRequestService } from './profile-field-amendment-request.service';
import { ProfileFieldAmendmentReviewService } from './profile-field-amendment-review.service';
import { ProfileFieldRevisionService } from './profile-field-revision.service';
import { AmendmentPhotoKind } from './profile-field-amendment.shared';

/** Thin application facade; storage, client submission and review remain isolated. */
@Injectable()
export class ProfileFieldAmendmentService {
  constructor(
    private readonly requests: ProfileFieldAmendmentRequestService,
    private readonly client: ProfileFieldAmendmentClientService,
    private readonly review: ProfileFieldAmendmentReviewService,
    private readonly revisions: ProfileFieldRevisionService,
  ) {}

  request(orderId: string, expertId: string, dto: CreateProfileFieldAmendmentDto) {
    return this.requests.request(orderId, expertId, dto);
  }

  saveDraft(userId: string, amendmentId: string, dto: SaveProfileFieldAmendmentDraftDto) {
    return this.client.saveDraft(userId, amendmentId, dto);
  }

  submit(userId: string, amendmentId: string, dto: SubmitProfileFieldAmendmentDto) {
    return this.client.submit(userId, amendmentId, dto);
  }

  approve(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    return this.review.approve(orderId, amendmentId, expertId, dto);
  }

  reject(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    return this.review.reject(orderId, amendmentId, expertId, dto);
  }

  requestRetake(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    return this.review.requestRetake(orderId, amendmentId, expertId, dto);
  }

  cancel(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    return this.review.cancel(orderId, amendmentId, expertId, dto);
  }

  createRevisedReading(
    orderId: string,
    amendmentId: string,
    expert: Expert,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    return this.revisions.createRevision(orderId, amendmentId, expert, dto);
  }

  getPhotoReference(options: {
    amendmentId: string;
    kind: AmendmentPhotoKind;
    userId?: string;
    orderId?: string;
  }) {
    return this.review.getPhotoReference(options);
  }
}
