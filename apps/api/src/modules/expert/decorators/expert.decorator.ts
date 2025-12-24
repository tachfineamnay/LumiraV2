import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentExpert = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.expert;
    },
);
