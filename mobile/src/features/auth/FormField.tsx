import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TextInputProps } from 'react-native';

import { Input } from '@/ui';

type Props<T extends FieldValues> = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
};

/** react-hook-form bound Input; error messages are i18n keys from the zod schema. */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  ...rest
}: Props<T>) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          label={label}
          hint={hint}
          value={(field.value as string | undefined) ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
          {...rest}
        />
      )}
    />
  );
}
