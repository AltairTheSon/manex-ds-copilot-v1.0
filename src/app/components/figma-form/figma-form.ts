import { Component, EventEmitter, Output, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FigmaCredentials } from '../../interfaces/figma.interface';

@Component({
  selector: 'app-figma-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './figma-form.html',
  styleUrl: './figma-form.scss'
})
export class FigmaForm {
  @Output() onConnect = new EventEmitter<FigmaCredentials>();
  @Input() isLoading = false;
  
  figmaForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.figmaForm = this.fb.group({
      accessToken: ['', [Validators.required, Validators.minLength(10)]],
      fileId: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9]+$/)]]
    });
  }

  onSubmit(): void {
    if (this.figmaForm.valid && !this.isLoading) {
      const credentials: FigmaCredentials = {
        accessToken: this.figmaForm.get('accessToken')?.value,
        fileId: this.figmaForm.get('fileId')?.value
      };
      this.onConnect.emit(credentials);
    }
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setCredentials(credentials: FigmaCredentials): void {
    this.figmaForm.patchValue({
      accessToken: credentials.accessToken,
      fileId: credentials.fileId
    });
  }

  getFieldError(fieldName: string): string | null {
    const field = this.figmaForm.get(fieldName);
    if (field && field.invalid && (field.dirty || field.touched)) {
      if (field.errors?.['required']) {
        return `${fieldName === 'accessToken' ? 'Access Token' : 'File ID'} is required`;
      }
      if (field.errors?.['minlength']) {
        return 'Access Token must be at least 10 characters long';
      }
      if (field.errors?.['pattern']) {
        return 'File ID contains invalid characters';
      }
    }
    return null;
  }
}
