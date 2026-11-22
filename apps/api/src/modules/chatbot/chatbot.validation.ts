import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class ChatMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 500, {
    message: 'Le message doit contenir entre 1 et 500 caractères',
  })
  message: string;
}