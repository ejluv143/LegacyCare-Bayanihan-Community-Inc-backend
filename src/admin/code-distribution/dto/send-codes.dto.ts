import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
} from "class-validator";

export class SendCodesDto {
  @IsUUID()
  @IsNotEmpty()
  satelliteId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({
    each: true,
  })
  codeIds!: string[];
}