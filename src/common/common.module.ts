import { Global, Module } from '@nestjs/common';
import { R2Service } from './services/r2.service';
import { MalwareScanService } from './uploads/malware-scan.service';
import { UploadValidationService } from './uploads/upload-validation.service';

@Global()
@Module({
  providers: [R2Service, MalwareScanService, UploadValidationService],
  exports: [R2Service, MalwareScanService, UploadValidationService],
})
export class CommonModule {}
