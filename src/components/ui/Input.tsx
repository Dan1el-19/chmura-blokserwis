import React from "react";
import { clsx } from "clsx";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedby,
      "aria-invalid": ariaInvalid,
      "aria-required": ariaRequired,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || `input-${generatedId}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const describedBy = [ariaDescribedby, errorId, helperId]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {props.required && (
              <span className="text-red-500 ml-1" aria-label="wymagane">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center justify-center pointer-events-none">
              <div
                className="h-5 w-5 text-gray-400 flex items-center justify-center"
                aria-hidden="true"
              >
                {leftIcon}
              </div>
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={clsx(
              "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
              "transition-colors duration-200",
              "autofill:bg-white autofill:text-black autofill:shadow-[0_0_0_30px_white_inset]",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-red-300 focus:border-red-500 focus:ring-red-500",
              className || "placeholder:text-gray-500"
            )}
            style={{
              WebkitTextFillColor: "black",
              WebkitBoxShadow: "0 0 0 30px white inset",
              boxShadow: "0 0 0 30px white inset",
            }}
            aria-label={ariaLabel}
            aria-describedby={describedBy || undefined}
            aria-invalid={ariaInvalid || !!error}
            aria-required={ariaRequired || props.required}
            {...props}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center justify-center">
              <div className="h-5 w-5 text-gray-400 flex items-center justify-center">
                {rightIcon}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            className="mt-1 text-sm text-red-600"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
