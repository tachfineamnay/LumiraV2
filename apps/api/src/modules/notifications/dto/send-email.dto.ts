export class SendEmailDto {
    to: string | string[];
    subject: string;
    template: string;
    context: any;
}

export interface OrderConfirmationContext {
    firstName: string;
    orderNumber: string;
    level: string;
    amount: string;
    expectedDelivery: string;
}

export interface ExpertAlertContext {
    orderNumber: string;
    clientName: string;
    level: string;
    createdAt: string;
}

export interface ContentReadyContext {
    firstName: string;
    sanctuaireLink: string;
    orderNumber: string;
}

export interface ReminderContext {
    firstName: string;
    sanctuaireLink: string;
    orderNumber: string;
}
