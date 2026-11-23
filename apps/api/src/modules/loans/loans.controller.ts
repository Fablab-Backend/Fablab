import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/users.model';
import { LoansService } from './loans.service';
import { CreateLoanDto, LoanQueryDto, ReturnLoanDto } from './loans.validation';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  findAll(@CurrentUser() user: UserDocument, @Query() query: LoanQueryDto) {
    return this.loansService.findAll(user, query);
  }

  @Post()
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateLoanDto) {
    return this.loansService.create(user, dto);
  }

  @Post(':id/return')
  returnLoan(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: ReturnLoanDto,
  ) {
    return this.loansService.returnLoan(user, id, dto);
  }
}
