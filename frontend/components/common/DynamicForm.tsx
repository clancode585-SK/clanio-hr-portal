"use client";

import React from "react";
import {
  useForm,
  FieldValues,
  Path,
  DefaultValues,
  UseFormReturn,
} from "react-hook-form";
import { ZodSchema } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

export interface OptionItem {
  label: string;
  value: string | number;
}

export interface FieldConfig<T extends FieldValues> {
  name: Path<T>;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "tel"
    | "date"
    | "time"
    | "select"
    | "textarea"
    | "checkbox"
    | "radio";
  placeholder?: string;
  options?: OptionItem[]; // For select & radio
  helperText?: string;
  colSpan?: 1 | 2 | 3 | 4; // Spanning multiple columns in grid
  disabled?: boolean;
  rows?: number; // For textarea
}

interface DynamicFormProps<T extends FieldValues> {
  schema: ZodSchema<T>;
  fields: FieldConfig<T>[];
  defaultValues?: DefaultValues<T>;
  onSubmit: (data: T, form: UseFormReturn<T>) => Promise<void> | void;
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
  columns?: 1 | 2 | 3 | 4;
  title?: string;
  description?: string;
  isDarkMode?: boolean;
}

export function DynamicForm<T extends FieldValues>({
  schema,
  fields,
  defaultValues,
  onSubmit,
  onCancel,
  submitText = "Save Changes",
  cancelText = "Cancel",
  columns = 1,
  title,
  description,
  isDarkMode = true,
}: DynamicFormProps<T>) {
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = form;

  React.useEffect(() => {
    if (defaultValues) {
      reset(defaultValues);
    }
  }, [defaultValues, reset]);

  const handleFormSubmit = async (data: T) => {
    await onSubmit(data, form);
  };

  const gridColsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  }[columns];

  const getColSpanClass = (span?: number) => {
    switch (span) {
      case 2:
        return "md:col-span-2";
      case 3:
        return "md:col-span-3";
      case 4:
        return "md:col-span-4";
      default:
        return "col-span-1";
    }
  };

  const inputStyle = (hasError: boolean, disabled?: boolean) => {
    if (isDarkMode) {
      return `w-full px-3.5 py-2.5 text-xs rounded-xl border outline-hidden transition-all duration-200 ${
        hasError
          ? "border-red-500/60 bg-red-500/10 text-white focus:ring-4 focus:ring-red-500/20"
          : "bg-white/[0.04] hover:bg-white/[0.07] focus:bg-[#081425] border-white/10 text-white placeholder-slate-500 focus:border-purple-500/80 focus:ring-4 focus:ring-purple-500/20"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;
    }

    return `w-full px-3.5 py-2.5 text-xs rounded-xl border outline-hidden transition-all duration-200 font-medium ${
      hasError
        ? "border-red-400 bg-red-50 text-red-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
        : "bg-slate-50/60 focus:bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 shadow-2xs"
    } ${disabled ? "bg-slate-100 cursor-not-allowed opacity-60" : ""}`;
  };

  return (
    <div
      className={`w-full rounded-2xl border backdrop-blur-xl overflow-hidden flex flex-col transition-all duration-300 ${
        isDarkMode
          ? "bg-[#0B1A30]/90 border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white"
          : "bg-white border border-slate-200/80 shadow-sm text-slate-900"
      }`}
    >
      {!isDarkMode && (
        <div className="w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700" />
      )}

      {(title || description) && (
        <div
          className={`p-6 border-b ${
            isDarkMode
              ? "border-white/[0.08] bg-white/[0.02]"
              : "border-blue-100 bg-blue-50/70"
          }`}
        >
          {title && (
            <div className="flex items-center gap-3">
              {!isDarkMode && (
                <div className="w-9 h-9 rounded-xl bg-blue-100/80 border border-blue-200 flex items-center justify-center shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
                </div>
              )}
              <div>
                <h3
                  className={`text-lg font-extrabold tracking-tight ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {title}
                </h3>
                {description && (
                  <p
                    className={`text-xs font-medium mt-0.5 ${
                      isDarkMode ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
        <div className={`grid ${gridColsClass} gap-x-6 gap-y-5`}>
          {fields.map((field) => {
            const error = errors[field.name];
            const errorMessage = error?.message as string | undefined;

            return (
              <div
                key={field.name}
                className={`${getColSpanClass(
                  field.colSpan
                )} flex flex-col justify-start`}
              >
                {/* Field Header / Label */}
                {field.type !== "checkbox" && (
                  <label
                    htmlFor={field.name}
                    className={`block text-xs font-extrabold uppercase tracking-wider mb-1.5 ${
                      isDarkMode ? "text-slate-300" : "text-slate-800"
                    }`}
                  >
                    {field.label}
                  </label>
                )}

                {/* Render input types */}
                {field.type === "textarea" ? (
                  <textarea
                    id={field.name}
                    rows={field.rows || 4}
                    placeholder={field.placeholder}
                    disabled={field.disabled || isSubmitting}
                    {...register(field.name)}
                    className={inputStyle(!!errorMessage, field.disabled || isSubmitting)}
                  />
                ) : field.type === "select" ? (
                  <select
                    id={field.name}
                    disabled={field.disabled || isSubmitting}
                    {...register(field.name)}
                    className={inputStyle(!!errorMessage, field.disabled || isSubmitting)}
                  >
                    <option value="" disabled className={isDarkMode ? "bg-[#0B1A30] text-slate-400" : "bg-white text-slate-400"}>
                      {field.placeholder || "Select an option..."}
                    </option>
                    {field.options?.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        className={isDarkMode ? "bg-[#0B1A30] text-white" : "bg-white text-slate-900"}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "checkbox" ? (
                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id={field.name}
                      disabled={field.disabled || isSubmitting}
                      {...register(field.name)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label
                      htmlFor={field.name}
                      className={`text-xs font-bold cursor-pointer select-none ${
                        isDarkMode ? "text-slate-300" : "text-slate-800"
                      }`}
                    >
                      {field.label}
                    </label>
                  </div>
                ) : field.type === "radio" ? (
                  <div className="flex flex-wrap gap-4 pt-1">
                    {field.options?.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${
                          isDarkMode ? "text-slate-300" : "text-slate-800"
                        }`}
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          disabled={field.disabled || isSubmitting}
                          {...register(field.name)}
                          className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type={field.type || "text"}
                    id={field.name}
                    placeholder={field.placeholder}
                    disabled={field.disabled || isSubmitting}
                    {...register(field.name)}
                    className={inputStyle(!!errorMessage, field.disabled || isSubmitting)}
                  />
                )}

                {/* Helper text */}
                {field.helperText && !errorMessage && (
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {field.helperText}
                  </p>
                )}

                {/* Error message */}
                {errorMessage && (
                  <p className="text-xs text-red-500 font-bold mt-1">
                    {errorMessage}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons Footer */}
        <div className={`pt-4 border-t flex items-center justify-end gap-3 ${
          isDarkMode ? "border-white/[0.08]" : "border-slate-100"
        }`}>
          {onCancel && (
            <button
              type="button"
              onClick={() => {
                reset();
                onCancel();
              }}
              disabled={isSubmitting}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all disabled:opacity-50 border cursor-pointer ${
                isDarkMode
                  ? "bg-white/[0.05] hover:bg-white/10 text-slate-300 border-white/10"
                  : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/80 shadow-2xs"
              }`}
            >
              {cancelText}
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/25 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isSubmitting ? "Processing..." : submitText}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
