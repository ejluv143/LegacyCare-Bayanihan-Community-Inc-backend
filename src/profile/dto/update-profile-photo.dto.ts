import { IsString, Matches, MaxLength } from 'class-validator';

export class UpdateProfilePhotoDto {
  @IsString()
  @MaxLength(1_500_000)
  @Matches(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, {
    message: 'Profile photo must be a valid JPG, PNG, or WEBP image.',
  })
  profilePhoto!: string;
}
