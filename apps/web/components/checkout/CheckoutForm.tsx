'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, UseFormRegister, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Check, AlertCircle, User, Mail, Phone } from 'lucide-react';

const isInternationalPhone = (value: string) => {
  const normalized = value.replace(/[\s().-]/g, '');
  return normalized === '' || /^(?:\+[1-9]\d{6,14}|0[1-9]\d{8,9})$/.test(normalized);
};

const formSchema = z.object({
  email: z.string().email('Email invalide'),
  phone: z.string().refine(isInternationalPhone, 'Numéro de téléphone invalide').optional(),
  firstName: z.string().min(2, 'Prénom requis (min 2 caractères)'),
  lastName: z.string().min(2, 'Nom requis (min 2 caractères)'),
});

export type CheckoutFormData = z.infer<typeof formSchema>;

interface CheckoutFormProps {
  onFormValid: (data: CheckoutFormData) => void;
  onFormInvalid: () => void;
  initialValues?: Partial<CheckoutFormData>;
}

const InputField = ({
  name,
  label,
  type = 'text',
  placeholder,
  icon: Icon,
  formatter,
  register,
  errors,
  watchedFields,
}: {
  name: keyof CheckoutFormData;
  label: string;
  type?: string;
  placeholder?: string;
  icon: React.ComponentType<{ className?: string }>;
  formatter?: (value: string) => string;
  register: UseFormRegister<CheckoutFormData>;
  errors: FieldErrors<CheckoutFormData>;
  watchedFields: CheckoutFormData;
}) => {
  const value = watchedFields[name] || '';
  const error = errors[name];
  const hasValue = value.length > 0;
  const isFieldValid = hasValue && !error;
  const inputId = `checkout-${name}`;
  const errorId = `${inputId}-error`;
  const autoComplete: Record<keyof CheckoutFormData, string> = {
    email: 'email',
    phone: 'tel',
    firstName: 'given-name',
    lastName: 'family-name',
  };
  const inputMode = name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text';

  return (
    <div className="relative group">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <span
          className={`transition-colors ${isFieldValid ? 'text-emerald-400' : hasValue && error ? 'text-rose-400' : ''}`}
          style={
            !isFieldValid && !(hasValue && error) ? { color: 'rgba(140,180,255,0.5)' } : undefined
          }
        >
          <Icon className="w-5 h-5" />
        </span>
      </div>
      <input
        id={inputId}
        {...register(name, {
          onChange: (e) => {
            if (formatter) {
              e.target.value = formatter(e.target.value);
            }
          },
        })}
        type={type}
        autoComplete={autoComplete[name]}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        placeholder={placeholder || label}
        className={`
                    w-full backdrop-blur-sm border rounded-xl pl-12 pr-12 py-4 
                    text-base text-white placeholder:text-blue-200/25
                    focus:outline-none focus:ring-2 transition-all duration-300
                    ${
                      isFieldValid
                        ? 'border-emerald-500/50 focus:ring-emerald-500/30 focus:border-emerald-500'
                        : hasValue && error
                          ? 'border-rose-500/50 focus:ring-rose-500/30 focus:border-rose-500'
                          : 'focus:ring-blue-400/20 focus:border-blue-400/40 hover:border-blue-300/20'
                    }
                `}
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderColor: isFieldValid
            ? undefined
            : hasValue && error
              ? undefined
              : 'rgba(130,180,255,0.15)',
        }}
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
            id={errorId}
            role="alert"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-rose-400 text-sm mt-1 ml-1"
          >
            {error.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export function CheckoutForm({ onFormValid, onFormInvalid, initialValues }: CheckoutFormProps) {
  const {
    register,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: initialValues,
  });

  const watchedFields = watch();

  useEffect(() => {
    if (!initialValues) return;
    // The Sanctuaire profile arrives after the first render. React Hook Form
    // reads defaultValues once, so reset is required to hydrate the form while
    // keepDirtyValues guarantees that a customer typing in the meantime wins.
    reset(initialValues, { keepDirtyValues: true, keepTouched: true, keepErrors: true });
  }, [initialValues, reset]);

  // Keep international prefixes such as +33, +52 and +212 intact.
  const formatPhone = (value: string) => {
    const hasPrefix = value.trimStart().startsWith('+');
    const digits = value.replace(/\D/g, '').slice(0, 15);
    return `${hasPrefix ? '+' : ''}${digits}`;
  };

  useEffect(() => {
    if (isValid) {
      onFormValid(watchedFields);
    } else {
      onFormInvalid();
    }
  }, [isValid, watchedFields, onFormValid, onFormInvalid]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="space-y-4"
    >
      <InputField
        name="email"
        label="Email"
        type="email"
        placeholder="votre@email.com"
        icon={Mail}
        register={register}
        errors={errors}
        watchedFields={watchedFields}
      />
      <InputField
        name="phone"
        label="Téléphone"
        type="tel"
        placeholder="+33 6 12 34 56 78"
        icon={Phone}
        formatter={formatPhone}
        register={register}
        errors={errors}
        watchedFields={watchedFields}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          name="firstName"
          label="Prénom"
          placeholder="Prénom"
          icon={User}
          register={register}
          errors={errors}
          watchedFields={watchedFields}
        />
        <InputField
          name="lastName"
          label="Nom"
          placeholder="Nom"
          icon={User}
          register={register}
          errors={errors}
          watchedFields={watchedFields}
        />
      </div>
    </motion.div>
  );
}
