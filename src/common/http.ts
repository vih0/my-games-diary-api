import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, Logger, ParseUUIDPipe } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';

export function uuidPipe(field: string) {
  return new ParseUUIDPipe({
    version: '4',
    exceptionFactory: () => new BadRequestException(`${field} deve ser um UUID válido.`),
  });
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (response.headersSent) return;
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    let message: string | string[] = 'Ocorreu um erro interno.';
    if (statusCode >= 500) {
      this.logger.error(exception);
    } else if (typeof payload === 'string') {
      message = payload;
    } else if (payload && 'message' in payload) {
      const value = payload.message;
      if (typeof value === 'string' || Array.isArray(value)) message = value;
    }
    response.status(statusCode).json({ statusCode, error: STATUS_CODES[statusCode], message });
  }
}
