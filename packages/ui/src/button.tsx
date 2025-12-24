import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary";
}

export const Button = ({ variant = "primary", className, ...props }: ButtonProps) => {
    const baseStyles = "px-4 py-2 rounded-md font-medium transition-colors";
    const variantStyles = variant === "primary"
        ? "bg-brand text-white hover:bg-brand-dark"
        : "bg-brand-light text-brand-dark hover:bg-gray-200";

    return (
        <button
            className={`${baseStyles} ${variantStyles} ${className || ""}`}
            {...props}
        />
    );
};
