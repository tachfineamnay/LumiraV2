'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Check, AlertCircle, User, Mail, Phone } from 'lucide-react';

const formSchema = z.object({
    email: z.string().email('Email invalide'),
    phone: z.string().regex(/^0[67]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/, 'Numéro de téléphone invalide').optional().or(z.literal('')),
    firstName: z.string().min(2, 'Prénom requis (min 2 caractères)'),
    lastName: z.string().min(2, 'Nom requis (min 2 caractères)'),
});

export type CheckoutFormData = z.infer<typeof formSchema>;

interface CheckoutFormProps {
    onFormValid: (data: CheckoutFormData) => void;
    onFormInvalid: () => void;
}

export function CheckoutForm({ onFormValid, onFormInvalid }: CheckoutFormProps) {
    const { register, watch, formState: { errors, isValid } } = useForm<CheckoutFormData>({
        resolver: zodResolver(formSchema),
        mode: 'onChange',
    });

    const watchedFields = watch();

    // Format phone number as user types
    const formatPhone = (value: string) => {
        const cleaned = value.replace(/\D/g, '').slice(0, 10);
        if (cleaned.length <= 2) return cleaned;
        if (cleaned.length <= 4) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
        if (cleaned.length <= 6) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4)}`;
        if (cleaned.length <= 8) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6)}`;
        return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
    };

    useEffect(() => {
        if (isValid) {
            onFormValid(watchedFields);
        } else {
            onFormInvalid();
        }
    }, [isValid, watchedFields, onFormValid, onFormInvalid]);

    const InputField = ({
        name,
        label,
        type = 'text',
        placeholder,
        icon: Icon,
        formatter
    }: {
        name: keyof CheckoutFormData;
        label: string;
        type?: string;
        placeholder?: string;
        icon: React.ComponentType<{ className?: string }>;
        formatter?: (value: string) => string;
    }) => {
        const value = watchedFields[name] || '';
        const error = errors[name];
        const hasValue = value.length > 0;
        const isFieldValid = hasValue && !error;

        return (
            <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Icon className={`w-5 h-5 transition-colors ${isFieldValid ? 'text-emerald-400' : hasValue && error ? 'text-rose-400' : 'text-cosmic-stardust'}`} />
                </div>
                <input
                    {...register(name, {
                        onChange: (e) => {
                            if (formatter) {
                                e.target.value = formatter(e.target.value);
                            }
                        }
                    })}
                    type={type}
                    placeholder={placeholder || label}
                    className={`
                        w-full bg-cosmic-deep/60 backdrop-blur-sm border rounded-xl pl-12 pr-12 py-4 
                        text-cosmic-divine placeholder:text-cosmic-stardust/50
                        focus:outline-none focus:ring-2 transition-all duration-300
                        ${isFieldValid
                            ? 'border-emerald-500/50 focus:ring-emerald-500/30 focus:border-emerald-500'
                            : hasValue && error
                                ? 'border-rose-500/50 focus:ring-rose-500/30 focus:border-rose-500'
                                : 'border-white/10 focus:ring-cosmic-gold/30 focus:border-cosmic-gold/50 hover:border-white/20'
                        }
                    `}
                />

                {/* Validation indicator */}
                <AnimatePresence>
                    {hasValue && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="absolute right-4 top-1/2 -translate-y-1/2"
                        >
                            {isFieldValid ? (
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                </div>
                            ) : error ? (
                                <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center">
                                    <AlertCircle className="w-3 h-3 text-rose-400" />
                                </div>
                            ) : null}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error message */}
                <AnimatePresence>
                    {error && (
                        <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-rose-400 text-xs mt-1 ml-1"
                        >
                            {error.message}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="space-y-4"
        >
            <InputField name="email" label="Email" type="email" placeholder="votre@email.com" icon={Mail} />
            <InputField name="phone" label="Téléphone" type="tel" placeholder="06 12 34 56 78" icon={Phone} formatter={formatPhone} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField name="firstName" label="Prénom" placeholder="Prénom" icon={User} />
                <InputField name="lastName" label="Nom" placeholder="Nom" icon={User} />
            </div>
        </motion.div>
    );
}
