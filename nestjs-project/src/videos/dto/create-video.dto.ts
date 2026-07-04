import { IsString } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  originalFilename: string;

  @IsString()
  contentType: string;
}
