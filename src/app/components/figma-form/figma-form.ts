import { Component, EventEmitter, Output, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FigmaCredentials, MCPCredentials, ConnectionRequest } from '../../interfaces/figma.interface';

@Component({
  selector: 'app-figma-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './figma-form.html',
  styleUrl: './figma-form.scss'
})
export class FigmaForm {
  @Output() onConnect = new EventEmitter<ConnectionRequest>();
  @Input() isLoading = false;
  
  connectionType: 'figma' | 'mcp' = 'figma';
  figmaForm: FormGroup;
  mcpForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.figmaForm = this.fb.group({
      accessToken: ['', [Validators.required, Validators.minLength(10)]],
      fileId: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9]+$/)]]
    });

    this.mcpForm = this.fb.group({
      serverUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      apiKey: [''],
      projectId: ['', [Validators.required]]
    });
  }

  get currentForm(): FormGroup {
    return this.connectionType === 'figma' ? this.figmaForm : this.mcpForm;
  }

  switchConnectionType(type: 'figma' | 'mcp'): void {
    this.connectionType = type;
  }

  onSubmit(): void {
    const form = this.currentForm;
    if (form.valid && !this.isLoading) {
      const connectionRequest: ConnectionRequest = {
        connectionType: this.connectionType,
        credentials: this.connectionType === 'figma' 
          ? {
              accessToken: this.figmaForm.get('accessToken')?.value,
              fileId: this.figmaForm.get('fileId')?.value
            } as FigmaCredentials
          : {
              serverUrl: this.mcpForm.get('serverUrl')?.value,
              apiKey: this.mcpForm.get('apiKey')?.value || undefined,
              projectId: this.mcpForm.get('projectId')?.value
            } as MCPCredentials
      };
      this.onConnect.emit(connectionRequest);
    }
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setCredentials(credentials: FigmaCredentials | MCPCredentials, type?: 'figma' | 'mcp'): void {
    if (type) {
      this.connectionType = type;
    }
    
    if (this.connectionType === 'figma') {
      const figmaCredentials = credentials as FigmaCredentials;
      this.figmaForm.patchValue({
        accessToken: figmaCredentials.accessToken,
        fileId: figmaCredentials.fileId
      });
    } else {
      const mcpCredentials = credentials as MCPCredentials;
      this.mcpForm.patchValue({
        serverUrl: mcpCredentials.serverUrl,
        apiKey: mcpCredentials.apiKey || '',
        projectId: mcpCredentials.projectId
      });
    }
  }

  getFieldError(fieldName: string): string | null {
    const form = this.currentForm;
    const field = form.get(fieldName);
    
    if (field && field.invalid && (field.dirty || field.touched)) {
      if (field.errors?.['required']) {
        const fieldLabels: { [key: string]: string } = {
          accessToken: 'Access Token',
          fileId: 'File ID',
          serverUrl: 'Server URL',
          projectId: 'Project ID'
        };
        return `${fieldLabels[fieldName] || fieldName} is required`;
      }
      if (field.errors?.['minlength']) {
        return 'Access Token must be at least 10 characters long';
      }
      if (field.errors?.['pattern']) {
        if (fieldName === 'fileId') {
          return 'File ID contains invalid characters';
        }
        if (fieldName === 'serverUrl') {
          return 'Please enter a valid URL starting with http:// or https://';
        }
      }
    }
    return null;
  }
}
