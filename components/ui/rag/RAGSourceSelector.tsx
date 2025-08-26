import { useState, useEffect } from 'react';
import { 
  XStack, 
  YStack, 
  Button, 
  Input, 
  ToggleGroup, 
  ScrollView,
  Progress,
  Text
} from 'tamagui';
import { 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  Tag, 
  CheckCircle, 
  Circle,
  RefreshCw,
  Server
} from '@tamagui/lucide-icons';
import { RegularText } from '../RegularText';
import { ProcessedDocument, DocumentChunk } from '@/services/rag/types';

interface RAGSourceSelectorProps {
  availableDocuments: ProcessedDocument[];
  selectedDocuments: Set<string>;
  onSelectionChange: (selectedUris: Set<string>) => void;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

interface DocumentCardProps {
  document: ProcessedDocument;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function DocumentCard({ document, isSelected, onToggleSelect }: DocumentCardProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getSourceName = (uri: string) => {
    try {
      if (uri.includes('/')) {
        const parts = uri.split('/');
        return parts[parts.length - 1] || parts[parts.length - 2] || uri;
      }
      return uri;
    } catch {
      return uri;
    }
  };

  return (
    <XStack
      backgroundColor={isSelected ? "$blue1" : "$gray1"}
      borderColor={isSelected ? "$blue6" : "$gray6"}
      borderWidth={1}
      borderRadius="$4"
      padding="$3"
      gap="$3"
      alignItems="center"
      onPress={onToggleSelect}
      pressStyle={{ backgroundColor: isSelected ? "$blue2" : "$gray2" }}
    >
      {/* Selection Indicator */}
      {isSelected ? (
        <CheckCircle size={20} color="$blue10" />
      ) : (
        <Circle size={20} color="$gray8" />
      )}

      {/* Document Info */}
      <YStack flex={1} gap="$1">
        <XStack alignItems="center" gap="$2">
          <Server size={14} color="$gray10" />
          <RegularText fontSize="$2" color="$gray10">
            {document.serverId}
          </RegularText>
        </XStack>
        
        <RegularText 
          fontSize="$4" 
          fontWeight="500" 
          color={isSelected ? "$blue10" : "$black"}
          numberOfLines={1}
        >
          {document.title || getSourceName(document.uri)}
        </RegularText>

        <XStack alignItems="center" gap="$3" flexWrap="wrap">
          <XStack alignItems="center" gap="$1">
            <FileText size={12} color="$gray10" />
            <RegularText fontSize="$2" color="$gray10">
              {document.metadata.chunkCount} chunks
            </RegularText>
          </XStack>
          
          <XStack alignItems="center" gap="$1">
            <Text fontSize="$2">📊</Text>
            <RegularText fontSize="$2" color="$gray10">
              {document.metadata.tokenCount} tokens
            </RegularText>
          </XStack>
          
          <XStack alignItems="center" gap="$1">
            <Calendar size={12} color="$gray10" />
            <RegularText fontSize="$2" color="$gray10">
              {new Date(document.metadata.processedAt).toLocaleDateString()}
            </RegularText>
          </XStack>
        </XStack>

        {/* Content Preview */}
        <RegularText 
          fontSize="$3" 
          color="$gray10" 
          numberOfLines={2}
          lineHeight={16}
        >
          {document.content.substring(0, 150)}...
        </RegularText>
      </YStack>
    </XStack>
  );
}

export function RAGSourceSelector({
  availableDocuments,
  selectedDocuments,
  onSelectionChange,
  onRefresh,
  isLoading,
  searchQuery = '',
  onSearchChange
}: RAGSourceSelectorProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [filterType, setFilterType] = useState<'all' | 'selected'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleSearch = (query: string) => {
    setLocalSearchQuery(query);
    onSearchChange?.(query);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleDocumentSelection = (uri: string) => {
    const newSelection = new Set(selectedDocuments);
    if (newSelection.has(uri)) {
      newSelection.delete(uri);
    } else {
      newSelection.add(uri);
    }
    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    const filteredDocs = getFilteredDocuments();
    const newSelection = new Set(selectedDocuments);
    filteredDocs.forEach(doc => newSelection.add(doc.uri));
    onSelectionChange(newSelection);
  };

  const clearSelection = () => {
    onSelectionChange(new Set());
  };

  const getFilteredDocuments = () => {
    let filtered = [...availableDocuments];

    // Apply text search
    if (localSearchQuery) {
      const query = localSearchQuery.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query) ||
        doc.uri.toLowerCase().includes(query) ||
        doc.serverId.toLowerCase().includes(query)
      );
    }

    // Apply filter type
    if (filterType === 'selected') {
      filtered = filtered.filter(doc => selectedDocuments.has(doc.uri));
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.metadata.processedAt - a.metadata.processedAt;
        case 'name':
          return a.title.localeCompare(b.title);
        case 'size':
          return b.metadata.tokenCount - a.metadata.tokenCount;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredDocuments = getFilteredDocuments();
  const selectedCount = selectedDocuments.size;
  const totalCount = availableDocuments.length;

  return (
    <YStack gap="$4" flex={1}>
      {/* Header with Search */}
      <YStack gap="$3">
        <XStack alignItems="center" gap="$2">
          <Search size={16} color="$gray10" />
          <Input
            flex={1}
            placeholder="Search documents..."
            value={localSearchQuery}
            onChangeText={handleSearch}
            backgroundColor="$gray1"
            borderColor="$gray6"
            borderRadius="$4"
          />
          <Button
            size="$3"
            backgroundColor="$gray2"
            borderColor="$gray6"
            borderWidth={1}
            borderRadius="$4"
            onPress={handleRefresh}
            disabled={isRefreshing}
            opacity={isRefreshing ? 0.6 : 1}
            icon={<RefreshCw size={16} />}
          >
            <RegularText>{isRefreshing ? 'Refreshing...' : 'Refresh'}</RegularText>
          </Button>
        </XStack>

        {/* Filters and Controls */}
        <XStack alignItems="center" gap="$3" flexWrap="wrap">
          {/* Filter Type */}
          <XStack alignItems="center" gap="$2">
            <Filter size={14} color="$gray10" />
            <ToggleGroup 
              type="single" 
              value={filterType} 
              onValueChange={(value: string) => setFilterType(value as 'all' | 'selected')}
              size="$2"
            >
              <ToggleGroup.Item 
                value="all" 
                borderColor={filterType === 'all' ? "black" : "$gray6"}
              >
                <RegularText fontSize="$3">All</RegularText>
              </ToggleGroup.Item>
              <ToggleGroup.Item 
                value="selected" 
                borderColor={filterType === 'selected' ? "black" : "$gray6"}
              >
                <RegularText fontSize="$3">Selected</RegularText>
              </ToggleGroup.Item>
            </ToggleGroup>
          </XStack>

          {/* Sort By */}
          <XStack alignItems="center" gap="$2">
            <RegularText fontSize="$3" color="$gray10">Sort:</RegularText>
            <ToggleGroup 
              type="single" 
              value={sortBy} 
              onValueChange={(value: string) => setSortBy(value as 'date' | 'name' | 'size')}
              size="$2"
            >
              <ToggleGroup.Item 
                value="date" 
                borderColor={sortBy === 'date' ? "black" : "$gray6"}
              >
                <RegularText fontSize="$3">Date</RegularText>
              </ToggleGroup.Item>
              <ToggleGroup.Item 
                value="name" 
                borderColor={sortBy === 'name' ? "black" : "$gray6"}
              >
                <RegularText fontSize="$3">Name</RegularText>
              </ToggleGroup.Item>
              <ToggleGroup.Item 
                value="size" 
                borderColor={sortBy === 'size' ? "black" : "$gray6"}
              >
                <RegularText fontSize="$3">Size</RegularText>
              </ToggleGroup.Item>
            </ToggleGroup>
          </XStack>

          {/* Selection Actions */}
          <XStack alignItems="center" gap="$2" marginLeft="auto">
            <Button
              size="$2"
              backgroundColor="$gray2"
              borderColor="$gray6"
              borderWidth={1}
              borderRadius="$3"
              onPress={selectAll}
              disabled={filteredDocuments.length === 0}
            >
              <RegularText fontSize="$3">Select All</RegularText>
            </Button>
            <Button
              size="$2"
              backgroundColor="$gray2"
              borderColor="$gray6"
              borderWidth={1}
              borderRadius="$3"
              onPress={clearSelection}
              disabled={selectedCount === 0}
            >
              <RegularText fontSize="$3">Clear</RegularText>
            </Button>
          </XStack>
        </XStack>

        {/* Selection Status */}
        <XStack alignItems="center" justifyContent="space-between">
          <RegularText fontSize="$3" color="$gray10">
            {selectedCount} of {totalCount} documents selected
          </RegularText>
          
          <RegularText fontSize="$3" color="$gray10">
            {filteredDocuments.length} shown
          </RegularText>
        </XStack>

        {/* Selection Progress */}
        {totalCount > 0 && (
          <Progress value={Math.round((selectedCount / totalCount) * 100)} max={100} height={4}>
            <Progress.Indicator backgroundColor="$blue10" />
          </Progress>
        )}
      </YStack>

      {/* Document List */}
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack gap="$3">
          {isLoading ? (
            <YStack alignItems="center" padding="$6" gap="$3">
              <RefreshCw size={24} color="$gray10" />
              <RegularText color="$gray10">Loading documents...</RegularText>
            </YStack>
          ) : filteredDocuments.length === 0 ? (
            <YStack alignItems="center" padding="$6" gap="$3">
              <FileText size={24} color="$gray8" />
              <RegularText color="$gray8" textAlign="center">
                {localSearchQuery ? 'No documents match your search' : 'No documents available'}
              </RegularText>
              {localSearchQuery && (
                <Button
                  size="$3"
                  backgroundColor="$gray2"
                  borderColor="$gray6"
                  borderWidth={1}
                  borderRadius="$4"
                  onPress={() => handleSearch('')}
                >
                  <RegularText>Clear Search</RegularText>
                </Button>
              )}
            </YStack>
          ) : (
            filteredDocuments.map(document => (
              <DocumentCard
                key={document.uri}
                document={document}
                isSelected={selectedDocuments.has(document.uri)}
                onToggleSelect={() => toggleDocumentSelection(document.uri)}
              />
            ))
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}