export class SendEmailDto {
    to: string | string[];
    subject: string;
    template: string;
    context: Record<string, unknown>;
}

export interface OrderConfirmationContext {
    [key: string]: unknown;
    firstName: string;
    orderNumber: string;
    level: string;
    amount: string;
    expectedDelivery: string;
}

export interface ExpertAlertContext {
    [key: string]: unknown;
    orderNumber: string;
    clientName: string;
    level: string;
    createdAt: string;
}

export interface ContentReadyContext {
    [key: string]: unknown;
    firstName: string;
    sanctuaireLink: string;
    orderNumber: string;
}

export interface ReminderContext {
    [key: string]: unknown;
    firstName: string;
    sanctuaireLink: string;
    orderNumber: string;
}
