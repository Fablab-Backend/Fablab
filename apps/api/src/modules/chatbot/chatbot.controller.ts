import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/users.model';
import { ChatbotService } from './chatbot.service';
import { ChatMessageDto } from './chatbot.validation';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  /** Tout utilisateur authentifié (JwtAuthGuard global). */
  @Post('message')
  @HttpCode(200)
  message(@Body() dto: ChatMessageDto, @CurrentUser() user: UserDocument) {
    return this.chatbotService.handleMessage(user, dto);
  }
}