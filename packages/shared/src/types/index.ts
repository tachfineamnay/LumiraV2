export interface User {
    id: string;
    email: string;
    createdAt: Date;
}

export type CatalogItem = {
    id: string;
    name: string;
    description?: string;
};
