import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FigmaService } from './figma.service';
import { FigmaCredentials } from '../interfaces/figma.interface';

describe('FigmaService - Image Batching', () => {
  let service: FigmaService;
  let httpMock: HttpTestingController;

  const mockCredentials: FigmaCredentials = {
    accessToken: 'test-token',
    fileId: 'test-file-id'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FigmaService]
    });
    service = TestBed.inject(FigmaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should split large node ID arrays into batches', () => {
    // Create array of 75 node IDs to test batching (should create 2 batches of 50 and 25)
    const nodeIds = Array.from({ length: 75 }, (_, i) => `node-${i}`);

    // Call getImages which should create batches
    service.getImages(mockCredentials, nodeIds).subscribe(response => {
      expect(response.images).toBeDefined();
      expect(Object.keys(response.images).length).toBe(75); // Should receive all images
    });

    // Expect 2 HTTP requests (batches)
    const req1 = httpMock.expectOne(req => req.url.includes('/images/') && req.url.includes('ids='));
    const req2 = httpMock.expectOne(req => req.url.includes('/images/') && req.url.includes('ids='));

    // Verify first batch has 50 IDs
    const firstBatchIds = req1.request.url.split('ids=')[1].split('&')[0].split(',');
    expect(firstBatchIds.length).toBe(50);

    // Verify second batch has 25 IDs  
    const secondBatchIds = req2.request.url.split('ids=')[1].split('&')[0].split(',');
    expect(secondBatchIds.length).toBe(25);

    // Mock responses
    const mockResponse1 = { images: {} };
    const mockResponse2 = { images: {} };
    
    // Add mock images for each batch
    firstBatchIds.forEach(id => mockResponse1.images[id] = `http://test.com/${id}.png`);
    secondBatchIds.forEach(id => mockResponse2.images[id] = `http://test.com/${id}.png`);

    req1.flush(mockResponse1);
    req2.flush(mockResponse2);
  });

  it('should handle empty node ID arrays', () => {
    service.getImages(mockCredentials, []).subscribe(response => {
      expect(response.images).toEqual({});
    });

    // Should not make any HTTP requests
    httpMock.expectNone(req => req.url.includes('/images/'));
  });

  it('should filter out invalid node IDs', () => {
    const nodeIds = ['valid-id', '', 'undefined', 'null', 'I-instance-id', '  ', 'another-valid-id'];

    service.getImages(mockCredentials, nodeIds).subscribe();

    // Should make one request with only valid IDs
    const req = httpMock.expectOne(req => req.url.includes('/images/'));
    
    const requestIds = req.request.url.split('ids=')[1].split('&')[0].split(',');
    expect(requestIds).toEqual(['valid-id', 'another-valid-id']);

    req.flush({ images: {} });
  });

  it('should handle individual batch failures gracefully', () => {
    const nodeIds = Array.from({ length: 75 }, (_, i) => `node-${i}`);

    service.getImages(mockCredentials, nodeIds).subscribe(response => {
      // Should still return a response even if one batch fails
      expect(response.images).toBeDefined();
    });

    const req1 = httpMock.expectOne(req => req.url.includes('/images/'));
    const req2 = httpMock.expectOne(req => req.url.includes('/images/'));

    // First batch succeeds
    const firstBatchIds = req1.request.url.split('ids=')[1].split('&')[0].split(',');
    const mockResponse1 = { images: {} };
    firstBatchIds.forEach(id => mockResponse1.images[id] = `http://test.com/${id}.png`);
    req1.flush(mockResponse1);

    // Second batch fails
    req2.error(new ErrorEvent('Network error'));
  });
});