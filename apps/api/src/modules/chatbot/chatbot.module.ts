import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResourcesModule } from '../resources/resources.module';
import { AI_PROVIDER, createAiProvider } from './chatbot.ai';
import { ChatbotController } from './chatbot.controller';
import { ChatMessage, ChatMessageSchema } from './chatbot.model';
import { ChatbotService } from './chatbot.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
    ResourcesModule,
  ],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    { provide: AI_PROVIDER, useFactory: createAiProvider },
  ],
})
export class ChatbotModule {}
