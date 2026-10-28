import { InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import type { ChangeEvent } from 'react';
import { PagePickerButton } from './PagePicker';

export default function LinkTextField(props: TextFieldProps) {
  const input =
    typeof props.slotProps?.input === 'object' ? props.slotProps.input : {};
  return (
    <TextField
      {...props}
      slotProps={{
        ...props.slotProps,
        input: {
          ...input,
          endAdornment: (
            <InputAdornment position='end'>
              <PagePickerButton
                onSelect={href =>
                  props.onChange?.({
                    target: { value: href },
                    currentTarget: { value: href },
                  } as ChangeEvent<HTMLInputElement>)
                }
              />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
